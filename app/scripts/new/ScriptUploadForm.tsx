"use client";

import Link from "next/link";
import { useActionState, useState, type ChangeEvent } from "react";
import {
  previewScriptDifficultyAction,
  uploadScriptAction,
} from "@/lib/script-upload-actions";
import { INITIAL_PROFILE_STATE } from "@/lib/profile-action-state";
import { DifficultyStars } from "@/components/DifficultyStars";
import {
  detectFromScriptJson,
  detectVersionFromFilename,
  type OfficialLite,
} from "@/lib/scriptDetect";
import {
  SCRIPT_CATEGORY_LABELS,
  SCRIPT_TYPE_LABELS,
  type ScriptCategory,
  type ScriptJsonEntry,
  type ScriptType,
} from "@/lib/types";

export type { OfficialLite };

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

export function ScriptUploadForm({
  officials,
  showBulkUploadLink,
}: {
  officials: OfficialLite[];
  /** /scripts/bulk-upload is admin-only (see lib/admin.ts) — the page
   * itself already checked this before rendering this form. */
  showBulkUploadLink: boolean;
}) {
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
  // Diego's ask: show the system's own auto-computed difficulty right on
  // the upload form (not just after saving), and let it be dragged to a
  // different value before submitting. null = nothing computed yet (no
  // file chosen, or the file didn't parse) — the slider only appears once
  // there's a real starting estimate to adjust.
  const [difficulty, setDifficulty] = useState<number | null>(null);
  const [difficultyPending, setDifficultyPending] = useState(false);

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setFileNotice(null);
    setDifficulty(null);
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

      // Same scoring formula the server applies after a real upload (see
      // previewScriptDifficultyAction's own doc comment) — run against
      // this file's own text, which we already have in hand from the
      // read above. A failure here (network blip, sign-in expired) just
      // leaves the slider hidden; it doesn't block the rest of the form.
      setDifficultyPending(true);
      const preview = await previewScriptDifficultyAction(text);
      setDifficultyPending(false);
      setDifficulty(preview.difficulty);
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
    <>
      {showBulkUploadLink && (
        <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
          Got a bunch of files to add at once?{" "}
          <Link
            href="/scripts/bulk-upload"
            className="font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Bulk upload
          </Link>{" "}
          instead.
        </p>
      )}

      <form
        action={formAction}
        className={showBulkUploadLink ? "mt-4 space-y-5" : "mt-8 space-y-5"}
      >
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
            Author
          </label>
          <input
            id="author"
            name="author"
            type="text"
            required
            readOnly={authorLocked}
            onChange={(e) => setAuthor(e.target.value)}
            maxLength={200}
            value={author}
            placeholder={
              authorLocked
                ? "Taken from the file's own credit"
                : "This file doesn't credit an author — type one to upload it"
            }
            className={authorLocked ? readOnlyInputClasses : inputClasses}
          />
          {!authorLocked && author === "" && (
            <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              This script&apos;s file didn&apos;t credit an author — enter one
              above to upload it.
            </p>
          )}
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
          <span className="block text-sm font-medium">
            Difficulty{" "}
            <span className="font-normal text-zinc-500 dark:text-zinc-400">
              (auto-estimated)
            </span>
          </span>
          {difficultyPending ? (
            <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              Estimating…
            </p>
          ) : difficulty === null ? (
            <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              Choose a file above to see the system&apos;s estimate — you&apos;ll
              be able to adjust it before submitting.
            </p>
          ) : (
            <div className="mt-1.5">
              <DifficultyStars difficulty={difficulty} size="lg" />
              <input
                type="range"
                min={1}
                max={6}
                step={0.25}
                value={difficulty}
                onChange={(e) => setDifficulty(Number(e.target.value))}
                className="mt-2 w-full accent-amber-500"
                aria-label="Difficulty"
              />
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Estimated from this script&apos;s characters, jinxes, and
                rules — drag the slider if you think it guessed wrong.
              </p>
            </div>
          )}
          <input type="hidden" name="difficulty" value={difficulty ?? ""} />
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
    </>
  );
}
