import {
  entryCharacterId,
  isCharacterObjectEntry,
  isMetaEntry,
  type Edition,
  type ScriptCategory,
  type ScriptJsonEntry,
  type ScriptType,
  type Team,
} from "@/lib/types";

/** The lean id/team/edition-only projection of the official character
 * library the auto-detect heuristic below needs, without carrying every
 * official character's full ability text just for this. Shared by
 * ScriptUploadForm.tsx (client, single-file picker) and
 * bulkUploadScriptsAction (server, many-files-at-once — see
 * lib/script-upload-actions.ts) so both paths guess a script's
 * name/author/version/type/category the exact same way. */
export interface OfficialLite {
  characterId: string;
  team: Team;
  edition: Edition;
}

/** Scripts with 13 or fewer player-facing characters (Townsfolk through
 * Demon — Travellers are optional add-ons and Fabled/Loric are script-wide
 * rule modifiers rather than roles anyone plays) read as Teensyville by
 * BOTC convention; anything bigger reads as a Full script. Diego didn't
 * give an exact rule for this one (unlike Category, below), so this is a
 * best-effort default — always user-overridable before submit. */
const TEENSYVILLE_MAX_CORE_CHARACTERS = 13;

const BASE_THREE_EDITIONS: readonly Edition[] = ["tb", "bmr", "snv"];

export interface Detected {
  name?: string;
  author?: string;
  version?: string;
  scriptType?: ScriptType;
  category: ScriptCategory;
}

/** Mirrors the category heuristic already applied server-side to every
 * existing script (see
 * supabase/migrations/20260915010000_script_version_category.sql): a
 * script becomes 'homebrew' the moment any of its characters isn't
 * resolvable to the official library, 'base_three' only if every
 * character comes from Trouble Brewing/Bad Moon Rising/Sects & Violets,
 * and 'custom' otherwise (official Travellers/Fabled/Loric/extras mixed
 * in, but nothing truly homebrew). Also opportunistically pulls the
 * script's own name/author/version and guesses Script Type from the
 * player-facing character count — none of this blocks submission if it
 * gets something wrong; the single-upload form leaves every field
 * editable, and bulkUploadScriptsAction skips a file outright rather than
 * guess at a still-missing name or author (see that function's own
 * comment). */
export function detectFromScriptJson(
  entries: ScriptJsonEntry[],
  officials: OfficialLite[],
): Detected {
  const officialById = new Map(officials.map((o) => [o.characterId, o]));
  const meta = entries.find(isMetaEntry);

  let sawAnyCharacter = false;
  let sawHomebrew = false;
  let sawNonBaseThree = false;
  let coreCount = 0;

  for (const entry of entries) {
    if (isMetaEntry(entry)) continue;
    const id = entryCharacterId(entry);
    if (!id) continue;
    sawAnyCharacter = true;

    const official = officialById.get(id);
    if (!official) {
      sawHomebrew = true;
    } else if (!BASE_THREE_EDITIONS.includes(official.edition)) {
      sawNonBaseThree = true;
    }

    const team =
      official?.team ?? (isCharacterObjectEntry(entry) ? entry.team : undefined);
    if (team && team !== "traveller" && team !== "fabled" && team !== "loric") {
      coreCount += 1;
    }
  }

  const category: ScriptCategory = sawHomebrew
    ? "homebrew"
    : sawAnyCharacter && !sawNonBaseThree
      ? "base_three"
      : "custom";

  const rawVersion = (meta as { version?: unknown } | undefined)?.version;

  return {
    name: meta?.name,
    author: meta?.author,
    version: typeof rawVersion === "string" ? rawVersion : undefined,
    scriptType: sawAnyCharacter
      ? coreCount <= TEENSYVILLE_MAX_CORE_CHARACTERS
        ? "teensyville"
        : "full"
      : undefined,
    category,
  };
}

/** A lot of homebrew scripts get re-exported/re-downloaded with the
 * version baked into the filename instead of (or in addition to)
 * `_meta.version` — e.g. "A Lleech of Distrust_2_1_1 (1).json" for
 * version 2.1.1, the " (1)" being Windows' own dedup suffix for a
 * repeat download, not part of the version. Treated as a fallback: the
 * JSON's own `_meta.version` wins when present (see the call sites), this
 * only fills in when the file didn't say. Requires at least two
 * underscore/space-separated trailing numbers so an ordinary name ending
 * in a single digit (e.g. "Script 2.json") isn't misread as a version. */
export function detectVersionFromFilename(filename: string): string | undefined {
  const withoutExt = filename.replace(/\.[^./\\]+$/, "");
  const trimmed = withoutExt.replace(/\s*\(\d+\)\s*$/, "").trim();
  const match = trimmed.match(/(?:[ _]\d+){2,}$/);
  if (!match) return undefined;
  const numbers = match[0].split(/[ _]/).filter(Boolean);
  return numbers.join(".");
}
