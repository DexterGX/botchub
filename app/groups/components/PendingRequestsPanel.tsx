"use client";

import { useState, useTransition } from "react";
import { respondToJoinRequestAction } from "@/lib/group-actions";
import type { PendingJoinRequestRow } from "@/lib/types";
import { UserAvatar } from "./UserAvatar";

/** Owner-only queue at the top of the Players tab — approve/reject a join
 * request, removing it from the list immediately (optimistic, same
 * pattern as LikeButton) rather than waiting on revalidatePath to refresh
 * the whole page. A rejected request isn't re-offered here even if the
 * owner reloads, since respondToJoinRequestAction flips its status away
 * from "pending" for good. */
export function PendingRequestsPanel({
  initialRequests,
}: {
  initialRequests: PendingJoinRequestRow[];
}) {
  const [requests, setRequests] = useState(initialRequests);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (requests.length === 0) return null;

  function respond(requestId: string, decision: "approve" | "reject") {
    setPendingId(requestId);
    startTransition(async () => {
      const result = await respondToJoinRequestAction(requestId, decision);
      if (result.ok) {
        setRequests((prev) => prev.filter((r) => r.id !== requestId));
      }
      setPendingId(null);
    });
  }

  return (
    <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
      <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-400">
        Pending join requests
      </h3>
      <ul className="mt-3 space-y-2">
        {requests.map((req) => (
          <li
            key={req.id}
            className="flex items-center justify-between gap-3 rounded-xl bg-white/60 p-2.5 dark:bg-black/20"
          >
            <div className="flex items-center gap-2.5">
              <UserAvatar
                displayName={req.requester_display_name}
                avatarUrl={req.requester_avatar_url}
                avatarCharacterIconUrl={req.requester_avatar_character_icon_url}
                size={32}
              />
              <span className="text-sm font-medium">
                {req.requester_display_name ?? "Someone"}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={isPending && pendingId === req.id}
                onClick={() => respond(req.id, "approve")}
                className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                Approve
              </button>
              <button
                type="button"
                disabled={isPending && pendingId === req.id}
                onClick={() => respond(req.id, "reject")}
                className="rounded-full border border-black/[.12] px-3 py-1 text-xs font-semibold transition-colors hover:border-zinc-400 disabled:opacity-60 dark:border-white/[.15] dark:hover:border-zinc-600"
              >
                Reject
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
