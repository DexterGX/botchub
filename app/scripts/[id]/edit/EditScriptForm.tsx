"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import {
  deleteScriptAction,
  updateScriptAction,
} from "@/lib/script-upload-actions";
import { DifficultyStars } from "@/components/DifficultyStars";
import {
  SCRIPT_CATEGORY_LABELS,
  SCRIPT_TYPE_LABELS,
  type Script,
} from "@/lib/types";

const inputClasses =
  "mt-1.5 w-full rounded-lg border border-black/[.12] bg-white px-4 py-2 text-sm outline-none focus:border-zinc-400 dark:border-white/[.15] dark:bg-zinc-900";

/** app/scripts/[id]/edit — Diego's ask: the metadata half of
 * ScriptUploadForm.tsx's fields (no file input, nothing to auto-detect;
 * this script's characters already exist), plus a danger zone that folds
 * in what used to be a standalone Delete icon on the /scripts browse
 * table. Same in-place two-click confirm as SettingsPanel's "End this
 * group" for the delete, since this now has its own full section to do
 * that properly instead of the compact icon-swap version a table row
 * forced onto it. */
export function EditScriptForm({ script }: { script: Script }) {
  const boundUpdate = updateScriptAction.bind(null, script.id);
  const [state, formAction, isPending] = useActionState(boundUpdate, {
    error: null,
  });

  const [difficulty, setDifficulty] = useState(script.difficulty ?? 3);

  // --- Delete this script ---------------------------------------------------
  const router = useRouter();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();

  function handleDeleteConfirm() {
    setDeleteError(null);
    startDeleteTransition(async () => {
      const result = await deleteScriptAction(script.id);
      if (!result.ok) {
        setDeleteError(result.error ?? "Something went wrong.");
        return;
      }
      router.push("/scripts");
    });
  }

  return (
    <>
      <form action={formAction} className="mt-8 space-y-5">
        <div>
          <label htmlFor="scriptName" className="block text-sm font-medium">
            Script name
          </label>
          <input
            id="scriptName"
            name="scriptName"
            type="text"
            required
            maxLength={200}
            defaultValue={script.name}
            className={inputClasses}
          />
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
            maxLength={200}
            defaultValue={script.author ?? ""}
            className={inputClasses}
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
            defaultValue={script.description ?? ""}
            placeholder="A short blurb shown near the title."
            className={inputClasses}
          />
        </div>

        <div>
          <span className="block text-sm font-medium">Difficulty</span>
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
          </div>
          <input type="hidden" name="difficulty" value={difficulty} />
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
            defaultValue={script.version}
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
            defaultValue={script.script_type}
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
            defaultValue={script.category}
            className={inputClasses}
          >
            {Object.entries(SCRIPT_CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
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
            defaultValue={script.notes ?? ""}
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
          {isPending ? "Saving…" : "Save changes"}
        </button>
      </form>

      <section className="mt-10 rounded-2xl border border-rose-600/30 bg-rose-500/[.03] p-4 dark:border-rose-500/30 dark:bg-rose-500/[.05]">
        <h2 className="font-semibold text-rose-700 dark:text-rose-400">
          Delete this script
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Permanently removes it from the library, along with its likes and
          comments. Games already logged with it aren&apos;t deleted — they
          just stop pointing to a script.
        </p>

        {!confirmingDelete ? (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="mt-3 rounded-full border border-rose-600 px-4 py-2 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-600 hover:text-white dark:border-rose-500 dark:text-rose-400"
          >
            Delete script
          </button>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-rose-700 dark:text-rose-400">
              This can&apos;t be undone. Are you sure?
            </span>
            <button
              type="button"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="rounded-full bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {isDeleting ? "Deleting…" : "Yes, delete it"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="text-sm text-zinc-600 hover:underline dark:text-zinc-400"
            >
              Cancel
            </button>
          </div>
        )}
        {deleteError && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">
            {deleteError}
          </p>
        )}
      </section>
    </>
  );
}
