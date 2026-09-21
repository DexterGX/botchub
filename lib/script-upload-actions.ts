"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseScriptUpload } from "@/lib/scriptValidation";
import type { ScriptCategory, ScriptType } from "@/lib/types";
import type { ProfileActionState } from "@/lib/profile-action-state";

function friendlyError(message: string): string {
  return message || "Something went wrong. Please try again.";
}

const VALID_SCRIPT_TYPES: readonly ScriptType[] = ["full", "teensyville"];
const VALID_CATEGORIES: readonly ScriptCategory[] = [
  "base_three",
  "custom",
  "homebrew",
];
const DEFAULT_VERSION = "1.0.0";
const MIN_DIFFICULTY = 1;
const MAX_DIFFICULTY = 6;

/** True for a difficulty value the UI could actually produce — 1 to 6 in
 * quarter-star steps (compute_script_difficulty's own smallest increment).
 * Guards both previewScriptDifficultyAction's own math (harmless either
 * way, it's read-only) and, more importantly, uploadScriptAction's manual
 * override below — a stray/tampered value there ends up on a real row. */
function isValidDifficultyStep(value: number): boolean {
  if (!Number.isFinite(value)) return false;
  if (value < MIN_DIFFICULTY || value > MAX_DIFFICULTY) return false;
  // Reject anything off the quarter-star grid (e.g. 3.1) rather than
  // silently rounding it — floating-point means an exact *0.25 value can
  // still be a hair off zero here, hence the small epsilon.
  const steps = (value - MIN_DIFFICULTY) / 0.25;
  return Math.abs(steps - Math.round(steps)) < 1e-6;
}

export interface PreviewDifficultyResult {
  difficulty: number | null;
  error?: string;
}

/**
 * Upload form preview (Diego's ask): runs the exact same scoring formula
 * compute_script_difficulty() applies after a real upload, but against an
 * in-progress file selection that hasn't been saved yet — see
 * score_script_characters() (the shared math both this and
 * compute_script_difficulty() call into) and its migration for why this
 * needed pulling out of the persisted-rows-only original.
 *
 * Resolves each character the same way the real upload does: an inline
 * entry (full name/team/ability) scores from its own data; a bare-id
 * reference scores from the matching *official* character's data, when
 * one exists. A reference to neither an inline definition nor a known
 * official id (the upload's own "not a recognized official character"
 * rejection case) is simply left out of the preview's scoring — this is a
 * best-effort estimate shown before submit, not the validation gate
 * itself, which still runs for real in uploadScriptAction below.
 */
export async function previewScriptDifficultyAction(
  rawText: string,
): Promise<PreviewDifficultyResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { difficulty: null, error: "You need to be logged in." };
  }

  const validated = parseScriptUpload(rawText);
  if (!validated.ok) {
    return { difficulty: null, error: validated.error };
  }
  const { characters, meta } = validated.value;

  const referencedIds = characters
    .filter((c) => !c.inline)
    .map((c) => c.characterId);
  const { data: officials, error: officialsError } =
    referencedIds.length > 0
      ? await supabase
          .from("characters")
          .select("id, character_id, name, team, ability, other_night")
          .eq("is_homebrew", false)
          .in("character_id", referencedIds)
      : { data: [], error: null };
  if (officialsError) {
    return { difficulty: null, error: friendlyError(officialsError.message) };
  }
  const officialByCharacterId = new Map(
    (officials ?? []).map((o) => [o.character_id as string, o]),
  );

  const names: string[] = [];
  const teams: string[] = [];
  const abilities: string[] = [];
  const otherNights: (number | null)[] = [];
  const resolvedOfficialIds: string[] = [];

  for (const c of characters) {
    if (c.inline) {
      names.push(c.inline.name);
      teams.push(c.inline.team);
      abilities.push(c.inline.ability ?? "");
      otherNights.push(c.inline.otherNight ?? null);
      continue;
    }
    const official = officialByCharacterId.get(c.characterId);
    if (!official) continue; // unresolved — see the doc comment above
    names.push(official.name as string);
    teams.push(official.team as string);
    abilities.push((official.ability as string | null) ?? "");
    otherNights.push(official.other_night as number | null);
    resolvedOfficialIds.push(official.id as string);
  }

  // Jinxes only ever pair official characters (see character_jinxes) — a
  // script's own brand-new homebrew can't have one yet.
  let jinxCount = 0;
  if (resolvedOfficialIds.length > 1) {
    const { count, error: jinxError } = await supabase
      .from("character_jinxes")
      .select("id", { count: "exact", head: true })
      .in("character_a_id", resolvedOfficialIds)
      .in("character_b_id", resolvedOfficialIds);
    if (jinxError) {
      return { difficulty: null, error: friendlyError(jinxError.message) };
    }
    jinxCount = count ?? 0;
  }

  const { data: difficulty, error: scoreError } = await supabase.rpc(
    "score_script_characters",
    {
      p_names: names,
      p_teams: teams,
      p_abilities: abilities,
      p_other_nights: otherNights,
      p_jinx_count: jinxCount,
      p_has_bootlegger: (meta.bootleggerRules?.length ?? 0) > 0,
    },
  );
  if (scoreError) {
    return { difficulty: null, error: friendlyError(scoreError.message) };
  }

  return { difficulty: typeof difficulty === "number" ? difficulty : null };
}

/** Reads the uploaded script JSON from the file input — the upload form
 * only offers a file picker now (the earlier paste-JSON textarea was
 * removed), and a native <input type=file> inside a <form> submits the
 * File object straight through FormData with zero client JS required. */
async function readScriptJsonText(formData: FormData): Promise<string | null> {
  const file = formData.get("scriptFile");
  if (file instanceof File && file.size > 0) {
    return await file.text();
  }
  return null;
}

/**
 * Phase 4, "JSON upload only" slice: a signed-in user submits a script's
 * JSON (pasted or as a file), it's validated against the schema (see
 * lib/scriptValidation.ts), and saved as a new `scripts` row with their
 * account attached as owner/author. No editing or version history yet —
 * this only ever creates a brand-new script.
 *
 * `characters` and `script_characters` have owner-scoped insert policies
 * now (see supabase/migrations/20260912010000_upload_write_policies.sql)
 * so this runs entirely through the normal RLS-respecting session client —
 * this project has no service-role key configured, so that was the only
 * viable path anyway.
 *
 * No multi-statement transaction is available through the Supabase JS
 * client, so this inserts in dependency order (scripts, then characters,
 * then script_characters) and best-effort deletes the scripts row if a
 * later step fails, rather than leaving a half-populated script visible in
 * the public library. A single Postgres RPC wrapping all of this in a real
 * transaction would close that last gap — worth doing if partial failures
 * turn out to happen in practice.
 */
export async function uploadScriptAction(
  _prevState: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be logged in." };
  }

  const scriptType = String(formData.get("scriptType") ?? "full");
  if (!VALID_SCRIPT_TYPES.includes(scriptType as ScriptType)) {
    return { error: "Choose a valid script type." };
  }
  const category = String(formData.get("category") ?? "custom");
  if (!VALID_CATEGORIES.includes(category as ScriptCategory)) {
    return { error: "Choose a valid category." };
  }
  const description = String(formData.get("description") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const formScriptName = String(formData.get("scriptName") ?? "").trim();
  const formAuthor = String(formData.get("author") ?? "").trim();
  const version = String(formData.get("version") ?? "").trim() || DEFAULT_VERSION;

  // The upload form always submits its own live-adjusted difficulty
  // (auto-computed on file select via previewScriptDifficultyAction, then
  // user-editable — Diego's ask) once JS has run successfully. An absent
  // or off-grid value falls back to the server-side recompute below, same
  // as before this existed — a no-JS submit, or one where the preview
  // call itself failed, shouldn't be blocked on this.
  const difficultyRaw = String(formData.get("difficulty") ?? "").trim();
  const difficultyOverride =
    difficultyRaw && isValidDifficultyStep(Number(difficultyRaw))
      ? Number(difficultyRaw)
      : null;

  const rawText = await readScriptJsonText(formData);
  if (!rawText) {
    return { error: "Choose a script JSON file to upload." };
  }

  const validated = parseScriptUpload(rawText);
  if (!validated.ok) {
    return { error: validated.error };
  }
  const { meta, characters, raw } = validated.value;
  const bootleggerRules = meta.bootleggerRules ?? null;

  // The upload form's own Script Name field is now the authoritative
  // source (auto-filled from the JSON's _meta.name on file select, but
  // user-editable) — meta.name is just the fallback for a submit that
  // somehow skipped that autofill.
  const scriptName = formScriptName || meta.name;
  if (!scriptName) {
    return { error: "Give your script a name." };
  }

  // Resolve every referenced id against the official character library in
  // one query, so we know which entries need a brand-new homebrew
  // `characters` row and which just link to an existing official one.
  const allIds = characters.map((c) => c.characterId);
  const { data: officialMatches, error: lookupError } = await supabase
    .from("characters")
    .select("id, character_id")
    .eq("is_homebrew", false)
    .in("character_id", allIds);
  if (lookupError) {
    return { error: friendlyError(lookupError.message) };
  }

  const officialIdByCharacterId = new Map(
    (officialMatches ?? []).map((c) => [c.character_id, c.id as string]),
  );

  // Anything that isn't an official character must have come with a full
  // inline definition (name + team) to become a new homebrew character —
  // otherwise there's nothing to resolve it to.
  const unresolved = characters.filter(
    (c) => !officialIdByCharacterId.has(c.characterId) && !c.inline,
  );
  if (unresolved.length > 0) {
    const ids = unresolved.map((c) => c.characterId).join(", ");
    return {
      error: `"${ids}" isn't a recognized official character, and this script didn't fully define it (needs at least a name and team to add it as homebrew).`,
    };
  }

  // Attribute the script to whatever the uploader put in the form's Author
  // field (auto-filled from the JSON's own credit when present, but
  // user-editable), falling back to the JSON's credit directly. Diego's
  // ask: stop silently falling back further to the uploader's own
  // display_name#tag when neither of those has one — a script's credited
  // author and whoever happens to be signed in uploading it aren't
  // reliably the same person (a re-upload of someone else's script, a
  // teammate uploading on the group's behalf, etc.), so Author is
  // required input now rather than a guess.
  const author = formAuthor || meta.author || null;
  if (!author) {
    return {
      error:
        "This script's file doesn't credit an author — type one in the Author field above.",
    };
  }

  const { data: newScript, error: scriptError } = await supabase
    .from("scripts")
    .insert({
      owner_id: user.id,
      name: scriptName,
      version,
      category,
      description: description || null,
      notes: notes || null,
      script_json: raw,
      edition: null,
      script_type: scriptType,
      author,
      bootlegger_rules: bootleggerRules,
      // Set straight away when the form supplied one, so there's no
      // window where the row briefly holds the auto-computed value
      // instead of the uploader's own chosen one.
      difficulty: difficultyOverride,
    })
    .select("id")
    .single();
  if (scriptError || !newScript) {
    return { error: friendlyError(scriptError?.message ?? "Couldn't save the script.") };
  }
  const scriptId = newScript.id as string;

  // Insert any brand-new homebrew characters this script introduces, with
  // the night-order/reminder fields passed straight through when the
  // uploader provided them — the official script-schema.json format
  // already carries these fields, so this is a pass-through, not new
  // design work.
  const toCreate = characters.filter(
    (c) => !officialIdByCharacterId.has(c.characterId) && c.inline,
  );
  const idByCharacterId = new Map(officialIdByCharacterId);

  if (toCreate.length > 0) {
    const { data: created, error: createError } = await supabase
      .from("characters")
      .insert(
        toCreate.map((c) => ({
          character_id: c.characterId,
          name: c.inline!.name,
          team: c.inline!.team,
          ability: c.inline!.ability ?? null,
          is_homebrew: true,
          source_script_id: scriptId,
          first_night: c.inline!.firstNight ?? null,
          first_night_reminder: c.inline!.firstNightReminder ?? null,
          other_night: c.inline!.otherNight ?? null,
          other_night_reminder: c.inline!.otherNightReminder ?? null,
        })),
      )
      .select("id, character_id");
    if (createError || !created) {
      await supabase.from("scripts").delete().eq("id", scriptId);
      return { error: friendlyError(createError?.message ?? "Couldn't save this script's homebrew characters.") };
    }
    for (const c of created) {
      idByCharacterId.set(c.character_id, c.id as string);
    }
  }

  const { error: linkError } = await supabase.from("script_characters").insert(
    characters.map((c, position) => ({
      script_id: scriptId,
      character_id: idByCharacterId.get(c.characterId)!,
      // Preserves this upload's own character order (see
      // supabase/migrations/20260913010000_script_character_position.sql)
      // — `characters` is already in the script JSON's original order
      // (parseScriptUpload pushes entries in array order), so its index
      // here is exactly the position we want read back in later.
      position,
    })),
  );
  if (linkError) {
    await supabase.from("scripts").delete().eq("id", scriptId);
    return { error: friendlyError(linkError.message) };
  }

  // Only recompute server-side when the form didn't already supply a
  // difficulty (see difficultyOverride above) — otherwise this would
  // silently clobber the uploader's own adjustment with the auto-computed
  // value the moment their submit finished, right after Diego's whole ask
  // was to let them override it. Best-effort, same as
  // increment_script_view_count below on the detail page: a script is
  // fully valid and viewable without a difficulty score, so a failure
  // here doesn't undo the upload. Has to happen after the script_characters
  // insert above, not alongside the scripts insert earlier, since
  // compute_script_difficulty() reads this script's own characters to do
  // its scoring.
  if (difficultyOverride === null) {
    await supabase.rpc("recompute_script_difficulty", { p_script_id: scriptId });
  }

  redirect(`/scripts/${scriptId}`);
}

export interface UpdateScriptResult {
  error: string | null;
}

/** /scripts/[id]/edit (Diego's ask: make the Edit action on /scripts do
 * something, gated on `script.owner_id === user.id` — see EditScriptForm).
 * Metadata-only: name/author/description/notes/version/type/category/
 * difficulty, the same fields uploadScriptAction lets an uploader set —
 * doesn't touch script_json/script_characters, so re-editing the actual
 * character roster of an existing script is still out of scope. The
 * "owners can update their own scripts" RLS policy (initial schema
 * migration) already scopes this to `scripts.owner_id = auth.uid()`, so
 * this is a plain client-side update rather than a new RPC. */
export async function updateScriptAction(
  scriptId: string,
  _prevState: UpdateScriptResult,
  formData: FormData,
): Promise<UpdateScriptResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be logged in." };
  }

  const scriptType = String(formData.get("scriptType") ?? "full");
  if (!VALID_SCRIPT_TYPES.includes(scriptType as ScriptType)) {
    return { error: "Choose a valid script type." };
  }
  const category = String(formData.get("category") ?? "custom");
  if (!VALID_CATEGORIES.includes(category as ScriptCategory)) {
    return { error: "Choose a valid category." };
  }
  const name = String(formData.get("scriptName") ?? "").trim();
  if (!name) {
    return { error: "Give your script a name." };
  }
  const author = String(formData.get("author") ?? "").trim();
  if (!author) {
    return { error: "Give your script an author." };
  }
  const description = String(formData.get("description") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const version = String(formData.get("version") ?? "").trim() || DEFAULT_VERSION;

  const difficultyRaw = String(formData.get("difficulty") ?? "").trim();
  if (!difficultyRaw || !isValidDifficultyStep(Number(difficultyRaw))) {
    return { error: "Choose a difficulty between 1 and 6 stars." };
  }
  const difficulty = Number(difficultyRaw);

  const { data: updated, error } = await supabase
    .from("scripts")
    .update({
      name,
      author,
      description: description || null,
      notes: notes || null,
      version,
      script_type: scriptType,
      category,
      difficulty,
    })
    .eq("id", scriptId)
    .select("id")
    .maybeSingle();
  if (error) {
    return { error: friendlyError(error.message) };
  }
  if (!updated) {
    return { error: "Only the script's uploader can edit it." };
  }

  redirect(`/scripts/${scriptId}`);
}

export interface DeleteScriptResult {
  ok: boolean;
  error?: string;
}

/** app/scripts/[id]/edit's danger zone (Diego's ask: fold the standalone
 * browse-table delete button into the edit page instead, "might be more
 * effective") — gated the same way updateScriptAction above is, on
 * `script.owner_id === user.id`. The "owners can delete their own
 * scripts" RLS policy (initial schema migration) already scopes this to
 * `scripts.owner_id = auth.uid()`, so this is a plain client-side delete
 * rather than a new RPC. script_characters, script_likes, script_tags,
 * and the rest of a script's join-table rows all cascade off scripts.id
 * (on delete cascade — see their own migrations); a game that was logged
 * using this script keeps its history (games.script_id just goes null)
 * instead of being deleted too. */
export async function deleteScriptAction(
  scriptId: string,
): Promise<DeleteScriptResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "You need to be logged in." };
  }

  const { data: deleted, error } = await supabase
    .from("scripts")
    .delete()
    .eq("id", scriptId)
    .select("id")
    .maybeSingle();
  if (error) {
    return { ok: false, error: friendlyError(error.message) };
  }
  if (!deleted) {
    return { ok: false, error: "Only the script's uploader can delete it." };
  }

  return { ok: true };
}
