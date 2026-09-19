import Link from "next/link";
import type { GroupCardRow } from "@/lib/types";
import { formatGroupPlaytime } from "@/lib/types";

/** One group on the /groups list — Diego's spec: name, ID#, playtime
 * range (or "No set date"), member count, optional cover photo. Cards
 * stack on mobile and grid on wider screens; the cover photo (when set)
 * is the card's banner rather than a small thumbnail, since Diego called
 * it "the main image of it". */
export function GroupCard({ group }: { group: GroupCardRow }) {
  return (
    <Link
      href={`/groups/${group.id}`}
      className="block overflow-hidden rounded-2xl border border-black/[.08] transition-colors hover:border-zinc-400 dark:border-white/[.145] dark:hover:border-zinc-600"
    >
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
          <span className="shrink-0 rounded-full bg-black/[.06] px-2.5 py-0.5 text-xs font-medium tabular-nums text-zinc-600 dark:bg-white/[.08] dark:text-zinc-400">
            ID# {group.invite_code}
          </span>
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
          <span>
            {group.member_count} member{group.member_count === 1 ? "" : "s"}
          </span>
          {group.my_role === "owner" && (
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
              Owner
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
