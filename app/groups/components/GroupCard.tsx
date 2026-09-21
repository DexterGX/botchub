import Link from "next/link";
import type { GroupCardRow } from "@/lib/types";
import { formatGroupPlaytime } from "@/lib/types";
import { GroupCardMenu } from "./GroupCardMenu";
import { CopyableCode } from "./CopyableCode";

/** One group on the /groups list — Diego's spec: name, ID#, playtime
 * range (or "No set date"), member count, optional cover photo. Cards
 * stack on mobile and grid on wider screens; the cover photo (when set)
 * is the card's banner rather than a small thumbnail, since Diego called
 * it "the main image of it". A group the viewer has left renders muted
 * (grayscale + reduced opacity) with its frozen final score in place of
 * the live member count/Owner pill — still clickable (the group itself is
 * still there to look back at), just visually read as "no longer live for
 * you". The ⋮ menu (GroupCardMenu) is a *sibling* of the muted content,
 * not a descendant of it — Diego's ask was for the menu and its options to
 * stay fully colored/legible even on a grayed-out card, and CSS opacity/
 * filter on a parent unavoidably dims every descendant's rendering
 * regardless of that descendant's own opacity — the only way to exempt the
 * menu is to keep it outside the muted subtree entirely. GroupCard itself
 * stays a server component. */
export function GroupCard({ group }: { group: GroupCardRow }) {
  const isLeft = group.membership_status === "left";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-black/[.08] transition-colors hover:border-zinc-400 dark:border-white/[.145] dark:hover:border-zinc-600">
      <GroupCardMenu
        groupId={group.id}
        isOwner={group.my_role === "owner"}
        status={group.membership_status}
      />

      <Link href={`/groups/${group.id}`} className="block">
        <div className={isLeft ? "opacity-60 grayscale" : ""}>
          {group.cover_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- user-supplied URL, not worth a remotePatterns entry
            <img
              src={group.cover_image_url}
              alt=""
              className="h-28 w-full object-cover"
            />
          ) : (
            <div className="h-28 w-full bg-gradient-to-br from-indigo-500/15 via-purple-500/10 to-transparent" />
          )}

          <div className="p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">{group.name}</span>
              <CopyableCode code={group.invite_code} />
            </div>

            {group.description && (
              <p className="mt-1 truncate text-sm text-zinc-600 dark:text-zinc-400">
                {group.description}
              </p>
            )}

            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Playtime: {formatGroupPlaytime(group.playtime_start, group.playtime_end)}
            </p>

            <div className="mt-2 flex items-center justify-between text-sm text-zinc-500 dark:text-zinc-500">
              {isLeft ? (
                <>
                  <span className="font-medium tabular-nums">
                    🪙 {group.frozen_points ?? 0} pts (final)
                  </span>
                  <span className="rounded-full bg-black/[.06] px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-white/[.08] dark:text-zinc-400">
                    Left
                  </span>
                </>
              ) : (
                <>
                  <span>
                    {group.member_count} member{group.member_count === 1 ? "" : "s"}
                  </span>
                  {group.my_role === "owner" && (
                    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                      Owner
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}
