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
  // user-editable), falling back to the JSON's credit directly and then to
  // the uploader's own display_name#tag.
  let author = formAuthor || meta.author || null;
  if (!author) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, tag")
      .eq("id", user.id)
      .maybeSingle();
    author = profile ? `${profile.display_name}#${profile.tag}` : null;
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

  redirect(`/scripts/${scriptId}`);
}
