"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteScriptAction } from "@/lib/script-upload-actions";

/** /scripts browse table's Actions column (Diego's ask): a delete action
 * for a script's own uploader, next to Download/PDF/Edit. Same in-place
 * two-click confirm as SettingsPanel's "End this group" (click once to
 * arm, click again to actually do it) rather than a native confirm()
 * popup — just a compact icon-swap version of it, since this lives inline
 * in a table row/action-icon row instead of its own section. Only ever
 * rendered when `script.owner_id === ` the signed-in user's id (see
 * ScriptsPage) — deleteScriptAction() itself is also scoped to the owner
 * server-side via RLS, so this is a UI convenience, not the real gate. */
export function DeleteScriptButton({
  scriptId,
  scriptName,
  size = "table",
}: {
  scriptId: string;
  scriptName: string;
  /** "table" — the desktop browse table's p-1.5 icon buttons. "card" — the
   * mobile card's slightly larger p-2 ones. Matches the padding every
   * other action icon in that same row already uses. */
  size?: "table" | "card";
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const padding = size === "card" ? "p-2" : "p-1.5";

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await deleteScriptAction(scriptId);
      if (!result.ok) {
        setError(result.error ?? "Something went wrong.");
        setConfirming(false);
        return;
      }
      // Re-fetches this server-rendered page's data — the deleted script's
      // row (and its total count) drop out on their own since
      // searchScripts() simply won't return it anymore.
      router.refresh();
    });
  }

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={isPending}
          title={`Permanently delete "${scriptName}"`}
          className={`rounded-lg border border-red-600 bg-red-600 ${padding} text-white transition-colors hover:bg-red-700 disabled:opacity-60`}
        >
          <CheckIcon />
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={isPending}
          title="Cancel"
          className={`rounded-lg border border-black/[.12] ${padding} text-zinc-600 transition-colors hover:border-zinc-400 hover:text-zinc-900 dark:border-white/[.15] dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-50`}
        >
          <XIcon />
        </button>
        {error && (
          <span className="text-xs font-medium whitespace-nowrap text-red-600 dark:text-red-400">
            {error}
          </span>
        )}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      title="Delete script"
      className={`rounded-lg border border-black/[.12] ${padding} text-zinc-600 transition-colors hover:border-red-400 hover:text-red-600 dark:border-white/[.15] dark:text-zinc-400 dark:hover:border-red-500 dark:hover:text-red-400`}
    >
      <TrashIcon />
    </button>
  );
}

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path
        d="M4 5.5h12M8 5.5v-1a1 1 0 011-1h2a1 1 0 011 1v1m2 0-.6 9.3a1.5 1.5 0 01-1.5 1.4H7.1a1.5 1.5 0 01-1.5-1.4L5 5.5h10z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M4 10.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
