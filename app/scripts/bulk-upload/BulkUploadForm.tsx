"use client";

import Link from "next/link";
import { useActionState, useState, type ChangeEvent } from "react";
import { bulkUploadScriptsAction } from "@/lib/script-upload-actions";
import { INITIAL_BULK_UPLOAD_STATE } from "@/lib/bulk-upload-action-state";

/** BulkUploadScriptPage's actual form — a single `multiple` file input
 * plus a per-file results list once bulkUploadScriptsAction comes back
 * (see that function's own doc comment for exactly what gets skipped and
 * why). Deliberately not a live per-file progress stream — Server Actions
 * don't have one to hook into here — so the button just shows "Importing…"
 * for however long the whole batch takes, then the full results list
 * appears at once. */
export function BulkUploadForm() {
  const [state, formAction, isPending] = useActionState(
    bulkUploadScriptsAction,
    INITIAL_BULK_UPLOAD_STATE,
  );
  const [fileCount, setFileCount] = useState(0);

  function handleFilesChange(e: ChangeEvent<HTMLInputElement>) {
    setFileCount(e.target.files?.length ?? 0);
  }

  const results = state.results;
  const importedCount = results?.filter((r) => r.ok).length ?? 0;
  const duplicateCount =
    results?.filter((r) => !r.ok && r.skippedDuplicate).length ?? 0;
  const failedCount = results
    ? results.length - importedCount - duplicateCount
    : 0;

  return (
    <form action={formAction} className="mt-8 space-y-5">
      <div>
        <label htmlFor="scriptFiles" className="block text-sm font-medium">
          Script JSON files
        </label>
        <input
          id="scriptFiles"
          name="scriptFiles"
          type="file"
          accept="application/json,.json"
          multiple
          required
          onChange={handleFilesChange}
          className="mt-1.5 block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-foreground file:px-4 file:py-2 file:text-sm file:font-medium file:text-background hover:file:bg-[#383838] dark:hover:file:bg-[#ccc]"
        />
        <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          {fileCount > 0
            ? `${fileCount} file${fileCount === 1 ? "" : "s"} selected.`
            : "Select every file at once — ctrl/cmd-click (or shift-click for a range) in the file picker."}
        </p>
      </div>

      {state.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={isPending || fileCount === 0}
        className="w-full rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-60 dark:hover:bg-[#ccc]"
      >
        {isPending
          ? "Importing…"
          : fileCount > 0
            ? `Import ${fileCount} script${fileCount === 1 ? "" : "s"}`
            : "Choose files to import"}
      </button>

      {results && (
        <div className="mt-6 space-y-3">
          <p className="text-sm font-medium">
            {importedCount} imported
            {duplicateCount > 0
              ? `, ${duplicateCount} already in the library`
              : ""}
            {failedCount > 0 ? `, ${failedCount} failed` : ""}.
          </p>
          <ul className="divide-y divide-black/[.08] rounded-xl border border-black/[.08] dark:divide-white/[.1] dark:border-white/[.1]">
            {results.map((r, i) => (
              <li
                key={`${r.filename}-${i}`}
                className="flex items-start gap-2 px-3 py-2 text-sm"
              >
                <span
                  className={
                    r.ok
                      ? "mt-0.5 text-emerald-600 dark:text-emerald-400"
                      : r.skippedDuplicate
                        ? "mt-0.5 text-zinc-400 dark:text-zinc-600"
                        : "mt-0.5 text-red-600 dark:text-red-400"
                  }
                  aria-hidden="true"
                >
                  {r.ok ? "✓" : r.skippedDuplicate ? "–" : "✗"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.filename}</p>
                  {r.ok ? (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Imported as{" "}
                      <Link
                        href={`/scripts/${r.scriptId}`}
                        className="text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {r.scriptName}
                      </Link>
                    </p>
                  ) : (
                    <p
                      className={
                        r.skippedDuplicate
                          ? "text-xs text-zinc-500 dark:text-zinc-400"
                          : "text-xs text-red-600 dark:text-red-400"
                      }
                    >
                      {r.error}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
}
