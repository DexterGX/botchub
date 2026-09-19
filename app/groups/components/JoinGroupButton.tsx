"use client";

import { useState, useTransition } from "react";
import { requestToJoinGroupAction } from "@/lib/group-actions";
import type { GroupVisibility } from "@/lib/types";

export type JoinButtonStatus = "none" | "member" | "pending";

/** The join affordance shown on a public-groups browse row or a
 * search-by-code result — same optimistic-then-reconcile shape as
 * app/scripts/LikeButton.tsx, just with three settled states instead of a
 * toggle: "none" (can request), "pending" (private group, waiting on the
 * owner), "member" (already in). */
export function JoinGroupButton({
  groupId,
  visibility,
  initialStatus,
}: {
  groupId: string;
  visibility: GroupVisibility;
  initialStatus: JoinButtonStatus;
}) {
  const [status, setStatus] = useState<JoinButtonStatus>(initialStatus);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (status === "member") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400">
        ✓ Joined
      </span>
    );
  }

  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-3 py-1.5 text-sm font-medium text-amber-700 dark:text-amber-400">
        Waiting for response
      </span>
    );
  }

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await requestToJoinGroupAction(groupId, visibility);
      if (!result.ok) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      if (result.status === "joined") setStatus("member");
      else if (result.status === "requested") setStatus("pending");
      else if (result.status === "already") setStatus("member");
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="rounded-full border border-black/[.12] px-3 py-1.5 text-sm font-semibold transition-colors hover:border-zinc-400 disabled:opacity-60 dark:border-white/[.15] dark:hover:border-zinc-600"
      >
        {isPending
          ? "…"
          : visibility === "public"
            ? "Join"
            : "Request to join"}
      </button>
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
