// Automated botcscripts.com library sync (Diego's ask, 2026-09-22).
//
// botc.games' owner told Diego they keep their own local copy of the
// botcscripts.com script library by polling its API roughly every 10
// minutes. Diego asked for the same for BOTChub, and — after being shown
// that botcscripts.com's robots.txt disallows this endpoint even though it
// works and is publicly reachable — explicitly chose to build it anyway.
// See claude/decisions.md for that decision's full history.
//
// Being asked to build this despite the robots.txt disallow isn't a
// license to be a bad citizen about *how*: this fetches exactly one
// results page (50 scripts) per run rather than the whole ~11k-script
// library, identifies itself with a descriptive User-Agent, and treats a
// failed fetch as "try this same page again next run" rather than retrying
// in a loop. Triggered by a pg_cron job roughly every 10 minutes (see the
// cron.schedule migration) calling this function. A full pass over the
// ~11k-script library takes about 36 hours at 50 scripts/page/10min before
// it wraps back to page 1 and starts checking for updates/new scripts
// again. Scripts that get deleted upstream on botcscripts.com are never
// removed here — this only ever adds or updates, a known/accepted gap.
//
// Deployed as a single file (no shared _shared/ module) because this
// project's Edge Function deploy path didn't resolve a relative sibling
// import reliably — everything below that would otherwise live in
// lib/scriptValidation.ts/lib/scriptDetect.ts on the Next.js side is
// duplicated inline instead. Edge Functions run on Deno as their own
// isolated bundle and can't import the app's "@/lib/..." path-aliased
// modules anyway, so this was always going to be a by-hand-synced twin,
// not a shared import — see the doc comments on parseScriptContent and
// detectCategory below for exactly which files they mirror and why.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const API_BASE = "https://www.botcscripts.com/api/scripts/";
const USER_AGENT = "BOTChub-Sync/1.0 (+https://botchub.com)";
const DEFAULT_VERSION = "1.0.0";

type Team =
  | "townsfolk"
  | "outsider"
  | "minion"
  | "demon"
  | "traveller"
  | "fabled"
  | "loric";

const VALID_TEAMS: readonly Team[] = [
  "townsfolk",
  "outsider",
  "minion",
  "demon",
  "traveller",
  "fabled",
  "loric",
];

function isValidTeam(value: unknown): value is Team {
  return typeof value === "string" && (VALID_TEAMS as readonly string[]).includes(value);
}

interface InlineCharacterDefinition {
  name: string;
  team: Team;
  ability?: string;
  firstNight?: number;
  firstNightReminder?: string;
  otherNight?: number;
  otherNightReminder?: string;
}

interface NormalizedCharacterRef {
  characterId: string;
  inline?: InlineCharacterDefinition;
}

interface ParsedScriptContent {
  characters: NormalizedCharacterRef[];
  bootleggerRules?: string[];
}

type ParseResult =
  | { ok: true; value: ParsedScriptContent }
  | { ok: false; error: string };

function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function readOptionalNightPosition(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    return undefined;
  }
  return value;
}

/** Deno-side twin of lib/scriptValidation.ts's parseScriptUpload. Same
 * entry shapes: a bare id string (official-character reference), an
 * `{id}`-only object (same thing), or a full inline definition with at
 * least name + team. Unlike the strict uploader version, this is lenient
 * about anything it doesn't understand (skips the entry rather than
 * failing the whole script) since this is third-party data, not a user
 * actively filling out a form who can fix a rejected file. Kept in sync BY
 * HAND with lib/scriptValidation.ts — mirror any rule change there. */
function parseScriptContent(content: unknown): ParseResult {
  if (!Array.isArray(content)) {
    return { ok: false, error: "content is not an array" };
  }

  const characters: NormalizedCharacterRef[] = [];
  const seenIds = new Set<string>();
  let bootleggerRules: string[] | undefined;

  for (const entry of content) {
    if (typeof entry === "string") {
      const id = entry.trim();
      if (!id || seenIds.has(id)) continue;
      seenIds.add(id);
      characters.push({ characterId: id });
      continue;
    }
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      continue;
    }
    const obj = entry as Record<string, unknown>;

    if (obj.id === "_meta") {
      if (Array.isArray(obj.bootlegger)) {
        const rules = obj.bootlegger
          .filter((r): r is string => typeof r === "string")
          .map((r) => r.trim())
          .filter(Boolean)
          .slice(0, 10);
        if (rules.length > 0) bootleggerRules = rules;
      }
      continue;
    }

    if (typeof obj.id !== "string" || !obj.id.trim()) continue;
    const id = obj.id.trim();
    if (seenIds.has(id)) continue;

    if (obj.name === undefined) {
      seenIds.add(id);
      characters.push({ characterId: id });
      continue;
    }

    const name = readOptionalString(obj.name);
    if (!name || !isValidTeam(obj.team)) {
      // Named entry that doesn't carry enough to become a homebrew
      // character (or has a team we don't recognize) — treat it as a
      // bare reference instead of dropping it outright, matching how a
      // reference-only entry behaves; it'll simply fail to resolve later
      // if it's not an official id either, and that one character (not
      // the whole script) gets skipped by the caller.
      seenIds.add(id);
      characters.push({ characterId: id });
      continue;
    }

    seenIds.add(id);
    characters.push({
      characterId: id,
      inline: {
        name,
        team: obj.team,
        ability: readOptionalString(obj.ability),
        firstNight: readOptionalNightPosition(obj.firstNight),
        firstNightReminder: readOptionalString(obj.firstNightReminder),
        otherNight: readOptionalNightPosition(obj.otherNight),
        otherNightReminder: readOptionalString(obj.otherNightReminder),
      },
    });
  }

  if (characters.length === 0) {
    return { ok: false, error: "no characters" };
  }

  return { ok: true, value: { characters, bootleggerRules } };
}

interface OfficialLite {
  characterId: string;
  edition: string | null;
  /** The character's real `characters.id` (primary key) — separate from
   * `characterId` (the human-chosen `character_id` slug like
   * "washerwoman") because script_characters links against the former. */
  rowId: string;
}

const BASE_THREE_EDITIONS = new Set(["tb", "bmr", "snv"]);

/** Deno-side twin of lib/scriptDetect.ts's category heuristic (see that
 * file's own doc comment): 'homebrew' the moment any character isn't
 * resolvable to the official library, 'base_three' only if every resolved
 * character comes from Trouble Brewing/Bad Moon Rising/Sects & Violets,
 * 'custom' otherwise. Unlike scriptDetect.ts this doesn't also guess
 * name/author/version/type — botcscripts.com's own API fields for those
 * are more reliable than guessing from `_meta`, so the caller uses those
 * directly instead. */
function detectCategory(
  characters: NormalizedCharacterRef[],
  officialById: Map<string, OfficialLite>,
): "base_three" | "custom" | "homebrew" {
  let sawHomebrew = false;
  let sawNonBaseThree = false;

  for (const c of characters) {
    const official = officialById.get(c.characterId);
    if (!official) {
      sawHomebrew = true;
    } else if (!official.edition || !BASE_THREE_EDITIONS.has(official.edition)) {
      sawNonBaseThree = true;
    }
  }

  if (sawHomebrew) return "homebrew";
  if (!sawNonBaseThree) return "base_three";
  return "custom";
}

/** sha256 hex digest of the script's raw content array, exactly as
 * received — used purely as a cheap "did this change since we last
 * synced it" signal, not for anything security-sensitive. */
async function hashContent(content: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(content));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

interface BotcscriptsResult {
  pk: number;
  script_id: number;
  name: string;
  version: string | null;
  script_type: string | null;
  author: string | null;
  content: unknown;
}

interface BotcscriptsPage {
  count: number;
  next: string | null;
  previous: string | null;
  results: BotcscriptsResult[];
}

interface SyncStateRow {
  next_page: number;
  total_pages: number | null;
  scripts_synced: number;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function fetchPage(page: number): Promise<BotcscriptsPage> {
  const url = `${API_BASE}?format=json&page=${page}`;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`botcscripts.com returned ${res.status} for page ${page}`);
  }
  return (await res.json()) as BotcscriptsPage;
}

/** Upserts one botcscripts.com script into `scripts`/`characters`/
 * `script_characters`. Mirrors insertScriptRow in
 * lib/script-upload-actions.ts (same three-table write, same "resolve
 * against official characters, create homebrew for the rest" logic) but
 * as an update-in-place keyed on external_script_id instead of always
 * inserting, and running under the service-role key so it isn't subject
 * to the owner-scoped RLS policies real uploads go through — there's no
 * signed-in "owner" for a synced script. */
async function syncOne(
  supabase: SupabaseClient,
  result: BotcscriptsResult,
  officialById: Map<string, OfficialLite>,
): Promise<{ status: "synced" | "unchanged" | "skipped"; reason?: string }> {
  const parsed = parseScriptContent(result.content);
  if (!parsed.ok) {
    return { status: "skipped", reason: parsed.error };
  }
  const { characters, bootleggerRules } = parsed.value;

  const name = (result.name ?? "").trim();
  const author = (result.author ?? "").trim();
  if (!name || !author) {
    return { status: "skipped", reason: "missing name or author" };
  }

  // Every referenced character must resolve to either an official one or
  // come with a full inline definition — same rule insertScriptRow
  // enforces for a real upload. A script with any truly-unresolvable
  // reference is skipped wholesale rather than imported with a gap.
  const unresolved = characters.filter(
    (c) => !officialById.has(c.characterId) && !c.inline,
  );
  if (unresolved.length > 0) {
    return {
      status: "skipped",
      reason: `unresolved character(s): ${unresolved.map((c) => c.characterId).join(", ")}`,
    };
  }

  const contentHash = await hashContent(result.content);
  const scriptType = (result.script_type ?? "").toLowerCase() === "teensyville"
    ? "teensyville"
    : "full";
  const category = detectCategory(characters, officialById);
  const version = (result.version ?? "").trim() || DEFAULT_VERSION;

  const { data: existing, error: existingError } = await supabase
    .from("scripts")
    .select("id, content_hash")
    .eq("external_script_id", result.script_id)
    .eq("source", "botcscripts_sync")
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing && existing.content_hash === contentHash) {
    // Nothing changed since last time — just bump the sync timestamp so
    // last_synced_at reflects that this script was checked, not stale.
    const { error } = await supabase
      .from("scripts")
      .update({ last_synced_at: new Date().toISOString(), external_pk: result.pk })
      .eq("id", existing.id);
    if (error) throw error;
    return { status: "unchanged" };
  }

  let scriptId: string;
  if (existing) {
    scriptId = existing.id as string;
    const { error } = await supabase
      .from("scripts")
      .update({
        name,
        author,
        version,
        category,
        script_type: scriptType,
        script_json: result.content,
        bootlegger_rules: bootleggerRules ?? null,
        external_pk: result.pk,
        content_hash: contentHash,
        last_synced_at: new Date().toISOString(),
      })
      .eq("id", scriptId);
    if (error) throw error;

    // Re-syncing a changed script means its character roster may have
    // changed too — clear the old links and this script's own homebrew
    // characters (characters_source_script_id_fkey is ON DELETE SET NULL,
    // so this delete alone wouldn't orphan-clean them) and rebuild both
    // from the freshly-parsed content below, the same as a brand-new
    // insert would.
    const { error: unlinkError } = await supabase
      .from("script_characters")
      .delete()
      .eq("script_id", scriptId);
    if (unlinkError) throw unlinkError;
    const { error: deleteHomebrewError } = await supabase
      .from("characters")
      .delete()
      .eq("source_script_id", scriptId)
      .eq("is_homebrew", true);
    if (deleteHomebrewError) throw deleteHomebrewError;
  } else {
    const { data: inserted, error } = await supabase
      .from("scripts")
      .insert({
        owner_id: null,
        source: "botcscripts_sync",
        external_script_id: result.script_id,
        external_pk: result.pk,
        content_hash: contentHash,
        last_synced_at: new Date().toISOString(),
        name,
        author,
        version,
        category,
        script_type: scriptType,
        script_json: result.content,
        bootlegger_rules: bootleggerRules ?? null,
        edition: null,
      })
      .select("id")
      .single();
    if (error || !inserted) throw error ?? new Error("insert returned no row");
    scriptId = inserted.id as string;
  }

  const toCreate = characters.filter(
    (c) => !officialById.has(c.characterId) && c.inline,
  );
  // Seed with every already-resolvable official character's real
  // characters.id (script_characters links against that, not the
  // human-chosen character_id slug) — the homebrew inserts below fill in
  // the rest as they're created.
  const idByCharacterId = new Map<string, string>();
  for (const c of characters) {
    const official = officialById.get(c.characterId);
    if (official) idByCharacterId.set(c.characterId, official.rowId);
  }

  if (toCreate.length > 0) {
    const { data: created, error: createError } = await supabase
      .from("characters")
      .insert(
        toCreate.map((c: NormalizedCharacterRef) => ({
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
      throw createError ?? new Error("homebrew character insert returned no rows");
    }
    for (const c of created) {
      idByCharacterId.set(c.character_id as string, c.id as string);
    }
  }

  const { error: linkError } = await supabase.from("script_characters").insert(
    characters.map((c, position) => ({
      script_id: scriptId,
      character_id: idByCharacterId.get(c.characterId)!,
      position,
    })),
  );
  if (linkError) throw linkError;

  const { error: difficultyError } = await supabase.rpc(
    "recompute_script_difficulty",
    { p_script_id: scriptId },
  );
  // Best-effort, same as insertScriptRow's own call to this RPC — a
  // missing difficulty score doesn't make the script invalid.
  if (difficultyError) {
    console.error(`recompute_script_difficulty failed for ${scriptId}:`, difficultyError);
  }

  return { status: "synced" };
}

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Missing SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY" }, 500);
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: state, error: stateError } = await supabase
    .from("botcscripts_sync_state")
    .select("next_page, total_pages, scripts_synced")
    .eq("id", true)
    .single();
  if (stateError || !state) {
    return jsonResponse({ error: stateError?.message ?? "sync state row missing" }, 500);
  }
  const syncState = state as SyncStateRow;

  let page: BotcscriptsPage;
  try {
    page = await fetchPage(syncState.next_page);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from("botcscripts_sync_state")
      .update({ last_run_at: new Date().toISOString(), last_error: message })
      .eq("id", true);
    return jsonResponse({ error: message }, 502);
  }

  const { data: officials, error: officialsError } = await supabase
    .from("characters")
    .select("id, character_id, edition")
    .eq("is_homebrew", false);
  if (officialsError) {
    return jsonResponse({ error: officialsError.message }, 500);
  }
  const officialById: Map<string, OfficialLite> = new Map(
    (officials ?? []).map((o) => [
      o.character_id as string,
      {
        characterId: o.character_id as string,
        edition: o.edition as string | null,
        rowId: o.id as string,
      },
    ]),
  );

  const outcomes = { synced: 0, unchanged: 0, skipped: 0 };
  const skipReasons: string[] = [];
  for (const result of page.results) {
    try {
      const outcome = await syncOne(supabase, result, officialById);
      outcomes[outcome.status]++;
      if (outcome.status === "skipped" && outcome.reason) {
        skipReasons.push(`${result.script_id}: ${outcome.reason}`);
      }
    } catch (err) {
      outcomes.skipped++;
      const message = err instanceof Error ? err.message : String(err);
      skipReasons.push(`${result.script_id}: ${message}`);
    }
  }

  const pageSize = page.results.length || 50;
  const totalPages = Math.max(1, Math.ceil(page.count / pageSize));
  const nextPage = page.next ? syncState.next_page + 1 : 1;

  await supabase
    .from("botcscripts_sync_state")
    .update({
      next_page: nextPage,
      total_pages: totalPages,
      last_run_at: new Date().toISOString(),
      last_success_at: new Date().toISOString(),
      last_error: skipReasons.length > 0 ? skipReasons.slice(0, 10).join(" | ") : null,
      scripts_synced: syncState.scripts_synced + outcomes.synced,
    })
    .eq("id", true);

  return jsonResponse({
    page: syncState.next_page,
    totalPages,
    nextPage,
    ...outcomes,
    skipReasons: skipReasons.slice(0, 10),
  });
});
