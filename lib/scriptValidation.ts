import type { Team } from "@/lib/types";

// Guardrails per architecture.md's Phase 4 spec: cap the raw upload size
// (~200KB is generous for what's fundamentally a few KB of JSON even for a
// large custom script) and reject anything that fails schema validation
// rather than silently storing malformed data — that's what would
// eventually corrupt search and the character-usage stats.
export const MAX_SCRIPT_JSON_BYTES = 200 * 1024;

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

/** An optional integer field (night-order position, "0 = doesn't wake" is a
 * valid value, distinct from "no data" which is just omitted). Rejects
 * anything present-but-not-a-non-negative-integer rather than coercing. */
function readOptionalNightPosition(
  value: unknown,
  field: string,
): { ok: true; value?: number } | { ok: false; error: string } {
  if (value === undefined || value === null) return { ok: true };
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    return { ok: false, error: `"${field}" must be a non-negative whole number.` };
  }
  return { ok: true, value };
}

function readOptionalString(
  value: unknown,
  field: string,
): { ok: true; value?: string } | { ok: false; error: string } {
  if (value === undefined || value === null) return { ok: true };
  if (typeof value !== "string") {
    return { ok: false, error: `"${field}" must be text.` };
  }
  const trimmed = value.trim();
  return { ok: true, value: trimmed || undefined };
}

// Per the official script-schema.json: `_meta.bootlegger` is an array of
// up to 10 custom homebrew-rule strings (distinct from the Bootlegger
// character's own fixed ability text, which just points here).
const MAX_BOOTLEGGER_RULES = 10;

function readOptionalStringArray(
  value: unknown,
  field: string,
): { ok: true; value?: string[] } | { ok: false; error: string } {
  if (value === undefined || value === null) return { ok: true };
  if (!Array.isArray(value)) {
    return { ok: false, error: `"${field}" must be a list of text.` };
  }
  if (value.length > MAX_BOOTLEGGER_RULES) {
    return {
      ok: false,
      error: `"${field}" can have at most ${MAX_BOOTLEGGER_RULES} entries (got ${value.length}).`,
    };
  }
  const rules: string[] = [];
  for (const [i, entry] of value.entries()) {
    if (typeof entry !== "string") {
      return { ok: false, error: `"${field}[${i}]" must be text.` };
    }
    const trimmed = entry.trim();
    if (trimmed) rules.push(trimmed);
  }
  return { ok: true, value: rules.length > 0 ? rules : undefined };
}

/** A character entry that resolves to a full inline definition — enough to
 * create a brand-new homebrew `characters` row if it doesn't already match
 * an official one. */
export interface InlineCharacterDefinition {
  name: string;
  team: Team;
  ability?: string;
  firstNight?: number;
  firstNightReminder?: string;
  otherNight?: number;
  otherNightReminder?: string;
}

export interface NormalizedCharacterRef {
  /** The script-json "id" string — e.g. "washerwoman", or a homebrew
   * author's own chosen id. Matched against characters.character_id. */
  characterId: string;
  /** Present when the entry carried a full object (name + team), not just
   * a bare id string or an `{id}`-only reference. Undefined means this
   * entry can ONLY resolve against an existing official character — the
   * upload flow must reject it if no such character exists. */
  inline?: InlineCharacterDefinition;
}

export interface NormalizedScriptUpload {
  meta: { name: string; author?: string; bootleggerRules?: string[] };
  /** De-duplicated, in original order. Guaranteed non-empty. */
  characters: NormalizedCharacterRef[];
  /** The exact parsed JSON array, stored verbatim as script_json — the
   * source of truth, per architecture.md ("JSON is the source of truth,
   * not the PDF"). */
  raw: unknown[];
}

export type ScriptValidationResult =
  | { ok: true; value: NormalizedScriptUpload }
  | { ok: false; error: string };

/**
 * Validates a raw uploaded script JSON string against this app's schema
 * expectations. Pure and DB-free on purpose — it doesn't know which
 * character ids are official vs. need creating; that's a database lookup
 * the caller (the upload Server Action) performs afterward, since this
 * module has no business opening a connection.
 */
export function parseScriptUpload(rawText: string): ScriptValidationResult {
  const byteLength = Buffer.byteLength(rawText, "utf8");
  if (byteLength === 0) {
    return { ok: false, error: "The uploaded file is empty." };
  }
  if (byteLength > MAX_SCRIPT_JSON_BYTES) {
    return {
      ok: false,
      error: `That file is too large (${Math.ceil(byteLength / 1024)}KB) — the limit is ${MAX_SCRIPT_JSON_BYTES / 1024}KB.`,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return { ok: false, error: "That file isn't valid JSON." };
  }

  if (!Array.isArray(parsed)) {
    return {
      ok: false,
      error: "A script JSON file must be an array (the format script.bloodontheclocktower.com and other script tools export).",
    };
  }

  let metaName: string | undefined;
  let metaAuthor: string | undefined;
  let metaBootleggerRules: string[] | undefined;
  let sawMeta = false;
  const characters: NormalizedCharacterRef[] = [];
  const seenIds = new Set<string>();

  for (const entry of parsed) {
    if (typeof entry === "string") {
      const id = entry.trim();
      if (!id) {
        return { ok: false, error: "A script entry is a blank string." };
      }
      if (seenIds.has(id)) {
        return { ok: false, error: `Character "${id}" appears more than once in this script.` };
      }
      seenIds.add(id);
      characters.push({ characterId: id });
      continue;
    }

    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      return { ok: false, error: "Every entry in the script must be either a character id string or an object." };
    }

    const obj = entry as Record<string, unknown>;

    if (obj.id === "_meta") {
      if (sawMeta) {
        return { ok: false, error: "A script can only have one _meta entry." };
      }
      sawMeta = true;
      const nameResult = readOptionalString(obj.name, "_meta.name");
      if (!nameResult.ok) return nameResult;
      if (!nameResult.value) {
        return { ok: false, error: "The script's _meta entry needs a name." };
      }
      metaName = nameResult.value;
      const authorResult = readOptionalString(obj.author, "_meta.author");
      if (!authorResult.ok) return authorResult;
      metaAuthor = authorResult.value;
      const bootleggerResult = readOptionalStringArray(obj.bootlegger, "_meta.bootlegger");
      if (!bootleggerResult.ok) return bootleggerResult;
      metaBootleggerRules = bootleggerResult.value;
      continue;
    }

    if (typeof obj.id !== "string" || !obj.id.trim()) {
      return { ok: false, error: "Every character entry needs a non-empty \"id\"." };
    }
    const id = obj.id.trim();
    if (seenIds.has(id)) {
      return { ok: false, error: `Character "${id}" appears more than once in this script.` };
    }
    seenIds.add(id);

    // An entry with just {id: "..."} — as real exports from
    // script.bloodontheclocktower.com use for most official-character
    // references — is a reference-only entry, resolved later against the
    // official character library. Only entries that also carry a name are
    // treated as candidates for a brand-new homebrew character.
    if (obj.name === undefined) {
      characters.push({ characterId: id });
      continue;
    }

    const nameResult = readOptionalString(obj.name, `"${id}".name`);
    if (!nameResult.ok) return nameResult;
    if (!nameResult.value) {
      return { ok: false, error: `Character "${id}" has a blank name.` };
    }
    if (!isValidTeam(obj.team)) {
      return {
        ok: false,
        error: `Character "${id}" (${nameResult.value}) needs a valid "team" (one of ${VALID_TEAMS.join(", ")}).`,
      };
    }
    const abilityResult = readOptionalString(obj.ability, `"${id}".ability`);
    if (!abilityResult.ok) return abilityResult;

    const firstNight = readOptionalNightPosition(obj.firstNight, `"${id}".firstNight`);
    if (!firstNight.ok) return firstNight;
    const firstNightReminder = readOptionalString(obj.firstNightReminder, `"${id}".firstNightReminder`);
    if (!firstNightReminder.ok) return firstNightReminder;
    const otherNight = readOptionalNightPosition(obj.otherNight, `"${id}".otherNight`);
    if (!otherNight.ok) return otherNight;
    const otherNightReminder = readOptionalString(obj.otherNightReminder, `"${id}".otherNightReminder`);
    if (!otherNightReminder.ok) return otherNightReminder;

    characters.push({
      characterId: id,
      inline: {
        name: nameResult.value,
        team: obj.team,
        ability: abilityResult.value,
        firstNight: firstNight.value,
        firstNightReminder: firstNightReminder.value,
        otherNight: otherNight.value,
        otherNightReminder: otherNightReminder.value,
      },
    });
  }

  if (!sawMeta || !metaName) {
    return { ok: false, error: "This script has no _meta entry with a name." };
  }
  if (characters.length === 0) {
    return { ok: false, error: "This script has no characters." };
  }

  return {
    ok: true,
    value: {
      meta: { name: metaName, author: metaAuthor, bootleggerRules: metaBootleggerRules },
      characters,
      raw: parsed,
    },
  };
}
