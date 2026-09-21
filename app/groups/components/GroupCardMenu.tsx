"use client";

import { useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { leaveGroupAction, removeLeftGroupAction } from "@/lib/group-actions";
import type { GroupMembershipStatus } from "@/lib/types";

const menuItemClasses =
  "block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-zinc-700 transition-colors hover:bg-black/[.05] dark:text-zinc-300 dark:hover:bg-white/[.08]";

/** The ⋮ menu on a /groups card — Diego's ask. Lives inside GroupCard's
 * `<Link>` (the whole card navigates to the group), so every click handler
 * here stops propagation/prevents default first or the menu would just
 * navigate away instead of opening. What the menu offers depends on the
 * viewer's relationship to the group:
 *   - owner: a shortcut straight to the group's own Settings tab (that's
 *     already where logo/transfer/end live — no need to duplicate them
 *     here).
 *   - active member: "Leave group" — freezes their points rather than
 *     deleting their membership outright (see leaveGroupAction).
 *   - already-left member (a grayed-out card): "Remove from my groups" —
 *     the later, separate step Diego asked for, that actually makes the
 *     card disappear. */
export function GroupCardMenu({
  groupId,
  isOwner,
  status,
}: {
  groupId: string;
  isOwner: boolean;
  status: GroupMembershipStatus;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function stop(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  function toggleOpen(e: MouseEvent) {
    stop(e);
    setOpen((o) => !o);
    setConfirming(false);
    setError(null);
  }

  function closeMenu(e: MouseEvent) {
    stop(e);
    setOpen(false);
  }

  async function handleLeave(e: MouseEvent) {
    stop(e);
    setPending(true);
    setError(null);
    const result = await leaveGroupAction(groupId);
    setPending(false);
    if (!result.ok) {
      setError(result.error ?? "Something went wrong.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  async function handleRemove(e: MouseEvent) {
    stop(e);
    setPending(true);
    setError(null);
    const result = await removeLeftGroupAction(groupId);
    setPending(false);
    if (!result.ok) {
      setError(result.error ?? "Something went wrong.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="absolute right-3 top-3 z-10" onClick={stop}>
      <button
        type="button"
        onClick={toggleOpen}
        aria-label="Group options"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-base leading-none text-white backdrop-blur-sm transition-colors hover:bg-black/60"
      >
        ⋮
      </button>

      {open && (
        <>
          {/* Click-outside-to-close backdrop — simpler and more reliable
              here than a document-level listener effect. */}
          <div className="fixed inset-0 z-10" onClick={closeMenu} />

          <div
            role="menu"
            className="absolute right-0 top-9 z-20 w-56 rounded-xl border border-black/[.08] bg-white p-1.5 shadow-lg dark:border-white/[.145] dark:bg-zinc-900"
          >
            {isOwner ? (
              // A plain button + router.push, not <Link> — this whole menu
              // renders inside GroupCard's own outer <Link>, and a nested
              // <a> inside an <a> is invalid HTML (React warns/hydration
              // errors on it) even though it "does" the same navigation.
              <button
                type="button"
                onClick={(e) => {
                  stop(e);
                  router.push(`/groups/${groupId}?tab=settings`);
                }}
                className={menuItemClasses}
              >
                Group settings
              </button>
            ) : status === "active" ? (
              !confirming ? (
                <button
                  type="button"
                  onClick={(e) => {
                    stop(e);
                    setConfirming(true);
                  }}
                  className={`${menuItemClasses} text-rose-700 hover:bg-rose-500/10 dark:text-rose-400`}
                >
                  Leave group
                </button>
              ) : (
                <div className="p-1.5">
                  <p className="px-1.5 text-xs text-zinc-500 dark:text-zinc-500">
                    Leave this group? Your points will be frozen.
                  </p>
                  <div className="mt-1.5 flex gap-1.5">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={handleLeave}
                      className="flex-1 rounded-lg bg-rose-600 px-2 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                    >
                      {pending ? "Leaving…" : "Yes, leave"}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        stop(e);
                        setConfirming(false);
                      }}
                      className="rounded-lg px-2 py-1.5 text-xs font-medium text-zinc-600 hover:bg-black/[.05] dark:text-zinc-400"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )
            ) : !confirming ? (
              <button
                type="button"
                onClick={(e) => {
                  stop(e);
                  setConfirming(true);
                }}
                className={menuItemClasses}
              >
                Remove from my groups
              </button>
            ) : (
              <div className="p-1.5">
                <p className="px-1.5 text-xs text-zinc-500 dark:text-zinc-500">
                  Remove this from your groups list? This can&apos;t be
                  undone.
                </p>
                <div className="mt-1.5 flex gap-1.5">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={handleRemove}
                    className="flex-1 rounded-lg bg-rose-600 px-2 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                  >
                    {pending ? "Removing…" : "Yes, remove"}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      stop(e);
                      setConfirming(false);
                    }}
                    className="rounded-lg px-2 py-1.5 text-xs font-medium text-zinc-600 hover:bg-black/[.05] dark:text-zinc-400"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {error && (
              <p className="px-1.5 pt-1.5 text-xs text-red-600 dark:text-red-400">
                {error}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
