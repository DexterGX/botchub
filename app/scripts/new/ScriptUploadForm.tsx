"use client";

import { useActionState, useState, type ChangeEvent } from "react";
import { uploadScriptAction } from "@/lib/script-upload-actions";
import { INITIAL_PROFILE_STATE } from "@/lib/profile-action-state";
import {
  SCRIPT_CATEGORY_LABELS,
  SCRIPT_TYPE_LABELS,
  entryCharacterId,
  isCharacterObjectEntry,
  isMetaEntry,
  type Edition,
  type ScriptCategory,
  type ScriptJsonEntry,
  type ScriptType,
  type Team,
} from "@/lib/types";

const inputClasses =
  "mt-1.5 w-full rounded-lg border border-black/[.12] bg-white px-4 py-2 text-sm outline-none focus:border-zinc-400 dark:border-white/[.15] dark:bg-zinc-900";

/** Script Name and Author lock to whatever the uploaded file itself says
 * (per Diego's ask — these should come straight from the JSON, not be
 * hand-edited) whenever the file actually supplies one. Plenty of real
 * exports skip `_meta` entirely or omit `author`, though, so each field
 * unlocks to a normal editable input the moment file selection comes back
 * without that piece — otherwise a file with no `_meta.name` could never
 * be uploaded at all, since nothing else can fill in the required name.
 * Locked fields get a visibly non-interactive style; they're still real,
 * submitted form fields (readOnly, not disabled — a disabled input's
 * value never makes it into FormData). */
const readOnlyInputClasses =
  "mt-1.5 w-full cursor-not-allowed rounded-lg border border-black/[.12] bg-zinc-100 px-4 py-2 text-sm text-zinc-600 outline-none dark:border-white/[.15] dark:bg-zinc-800 dark:text-zinc-400";

/** The lean id/team/edition-only projection of the official character
 * library that app/scripts/new/page.tsx passes down — everything the
 * client-side auto-detect heuristic below needs, without shipping every
 * official character's full ability text to the browser just for this. */
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

interface Detected {
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
 * gets something wrong, every field stays editable below. */
function detectFromScriptJson(
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
 * JSON's own `_meta.version` wins when present (see the call site), this
 * only fills in when the file didn't say. Requires at least two
 * underscore/space-separated trailing numbers so an ordinary name ending
 * in a single digit (e.g. "Script 2.json") isn't misread as a version. */
function detectVersionFromFilename(filename: string): string | undefined {
  const withoutExt = filename.replace(/\.[^./\\]+$/, "");
  const trimmed = withoutExt.replace(/\s*\(\d+\)\s*$/, "").trim();
  const match = trimmed.match(/(?:[ _]\d+){2,}$/);
  if (!match) return undefined;
  const numbers = match[0].split(/[ _]/).filter(Boolean);
  return numbers.join(".");
}

export function ScriptUploadForm({ officials }: { officials: OfficialLite[] }) {
  const [state, formAction, isPending] = useActionState(
    uploadScriptAction,
    INITIAL_PROFILE_STATE,
  );

  const [scriptName, setScriptName] = useState("");
  const [nameLocked, setNameLocked] = useState(true);
  const [author, setAuthor] = useState("");
  const [authorLocked, setAuthorLocked] = useState(true);
  const [version, setVersion] = useState("1.0.0");
  const [scriptType, setScriptType] = useState<ScriptType>("full");
  const [category, setCategory] = useState<ScriptCategory>("custom");
  const [fileNotice, setFileNotice] = useState<string | null>(null);

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setFileNotice(null);
    if (!file) return;

    // Independent of whether the JSON itself parses — the filename is
    // just a string, so this is worth trying either way (see the catch
    // block below).
    const versionFromFilename = detectVersionFromFilename(file.name);

    try {
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);
      if (!Array.isArray(parsed)) throw new Error("not a script array");
      const detected = detectFromScriptJson(
        parsed as ScriptJsonEntry[],
        officials,
      );

      // A file that doesn't supply a name/author unlocks that field for
      // manual entry instead of leaving it stuck blank and readOnly — see
      // the comment on readOnlyInputClasses above.
      setScriptName(detected.name ?? "");
      setNameLocked(!!detected.name);
      setAuthor(detected.author ?? "");
      setAuthorLocked(!!detected.author);
      // _meta.version, when the file has one, is more authoritative than
      // a guess from the filename — the filename is only a fallback.
      if (detected.version) setVersion(detected.version);
      else if (versionFromFilename) setVersion(versionFromFilename);
      if (detected.scriptType) setScriptType(detected.scriptType);
      setCategory(detected.category);
    } catch {
      // Auto-fill is a convenience, not validation — a file that doesn't
      // parse here just leaves the fields as they were; the real
      // validation runs server-side on submit and reports a proper error
      // there if the file itself is the problem. The version can still
      // come from the filename even when the JSON itself can't be read.
      if (versionFromFilename) setVersion(versionFromFilename);
      setFileNotice(
        "Couldn't read that file to auto-fill the fields below — you can still fill them in and submit; it'll be validated on upload.",
      );
    }
  }

  return (
    <form action={formAction} className="mt-8 space-y-5">
      <div>
        <label htmlFor="scriptFile" className="block text-sm font-medium">
          Script JSON file
        </label>
        <input
          id="scriptFile"
          name="scriptFile"
          type="file"
          accept="application/json,.json"
          required
          onChange={handleFileChange}
          className="mt-1.5 block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-foreground file:px-4 file:py-2 file:text-sm file:font-medium file:text-background hover:file:bg-[#383838] dark:hover:file:bg-[#ccc]"
        />
        <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          {fileNotice ??
            "Choosing a file auto-fills the fields below — review and edit anything before submitting."}
        </p>
      </div>

      <div>
        <label htmlFor="scriptName" className="block text-sm font-medium">
          Script name
        </label>
        <input
          id="scriptName"
          name="scriptName"
          type="text"
          required
          readOnly={nameLocked}
          onChange={(e) => setScriptName(e.target.value)}
          maxLength={200}
          value={scriptName}
          placeholder={
            nameLocked
              ? "Taken from the file's own name — choose a file above"
              : "This file doesn't include a name — type one here"
          }
          className={nameLocked ? readOnlyInputClasses : inputClasses}
        />
        {!nameLocked && scriptName === "" && (
          <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            This script&apos;s file didn&apos;t include a name — enter one
            above to upload it.
          </p>
        )}
      </div>

      <div>
        <label htmlFor="author" className="block text-sm font-medium">
          Author{" "}
          <span className="font-normal text-zinc-500 dark:text-zinc-400">
            (optional)
          </span>
        </label>
        <input
          id="author"
          name="author"
          type="text"
          readOnly={authorLocked}
          onChange={(e) => setAuthor(e.target.value)}
          maxLength={200}
          value={author}
          placeholder={
            authorLocked
              ? "Taken from the file's own credit, or your account name"
              : "This file doesn't credit an author — type one, or leave blank to use your account name"
          }
          className={authorLocked ? readOnlyInputClasses : inputClasses}
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium">
          Description{" "}
          <span className="font-normal text-zinc-500 dark:text-zinc-400">
            (optional)
          </span>
        </label>
        <textarea
          id="description"
          name="description"
          rows={2}
          maxLength={500}
          placeholder="A short blurb shown near the title."
          className={inputClasses}
        />
      </div>

      <div>
        <label htmlFor="version" className="block text-sm font-medium">
          Version
        </label>
        <input
          id="version"
          name="version"
          type="text"
          required
          maxLength={40}
          value={version}
          onChange={(e) => setVersion(e.target.value)}
          placeholder="1.0.0"
          className={inputClasses}
        />
      </div>

      <div>
        <label htmlFor="scriptType" className="block text-sm font-medium">
          Script type
        </label>
        <select
          id="scriptType"
          name="scriptType"
          value={scriptType}
          onChange={(e) => setScriptType(e.target.value as ScriptType)}
          className={inputClasses}
        >
          {Object.entries(SCRIPT_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="category" className="block text-sm font-medium">
          Category
        </label>
        <select
          id="category"
          name="category"
          value={category}
          onChange={(e) => setCategory(e.target.value as ScriptCategory)}
          className={inputClasses}
        >
          {Object.entries(SCRIPT_CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Auto-detected from the file&apos;s characters — change it if it
          guessed wrong.
        </p>
      </div>

      <div>
        <label htmlFor="notes" className="block text-sm font-medium">
          Notes{" "}
          <span className="font-normal text-zinc-500 dark:text-zinc-400">
            (optional)
          </span>
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          maxLength={2000}
          placeholder="Jinxes and other special rules already in the JSON are picked up and shown automatically, so there's no need to repeat those here."
          className={inputClasses}
        />
      </div>

      {state.error && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-60 dark:hover:bg-[#ccc]"
      >
        {isPending ? "Uploading…" : "Upload script"}
      </button>
    </form>
  );
}
