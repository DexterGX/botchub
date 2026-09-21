import type { GroupLeaderboardRow } from "@/lib/types";
import { rankGroupRows } from "@/lib/types";
import { UserAvatar } from "./UserAvatar";

// Purely positional — which of the 3 podium slots a row's *array position*
// lands in (center tallest, left medium, right smallest). Independent of
// the row's actual rank, which is what picks the medal below.
const SLOT_STYLES = [
  { order: "order-2", height: "h-24" },
  { order: "order-1", height: "h-16" },
  { order: "order-3", height: "h-12" },
];

// Keyed by the row's real, tie-aware rank (see rankGroupRows) rather than
// its slot — two rows tied for the same placement now get the same medal
// instead of one borrowing the next slot's fixed medal. That mismatch was
// Diego's report: the ranked list below correctly shows a multi-way tie
// for 2nd, but the podium used to hand out a lone silver and a lone
// bronze regardless, as if there were no tie at all.
const MEDAL_BY_RANK: Record<number, { medal: string; ring: string }> = {
  1: { medal: "🥇", ring: "ring-amber-400" },
  2: { medal: "🥈", ring: "ring-zinc-300" },
  3: { medal: "🥉", ring: "ring-orange-400" },
};

/** Top-3 podium above the Players tab's ranked list — Diego's ask, modeled
 * loosely on the Dribbble leaderboard reference he shared, kept small
 * ("no need to be too big") rather than a full illustrated podium. The
 * *slot* a row visually sits in (center/left/right, tallest-to-shortest)
 * still follows its position among the top 3, but the medal/ring color it
 * gets follows its real rank — so a tie always shows matching medals,
 * even though the slots themselves can't visually merge. */
export function Podium({ rows }: { rows: GroupLeaderboardRow[] }) {
  const ranks = rankGroupRows(rows);
  const top3 = rows.slice(0, 3).map((row, i) => ({ row, rank: ranks[i] }));
  if (top3.length === 0) return null;

  return (
    <div className="flex items-end justify-center gap-4 pb-2">
      {top3.map(({ row, rank }, index) => {
        const slot = SLOT_STYLES[index];
        const medal = MEDAL_BY_RANK[rank] ?? MEDAL_BY_RANK[3];
        const isLeftMember = row.status === "left";
        return (
          <div
            key={row.user_id}
            className={`flex flex-col items-center ${slot.order} ${isLeftMember ? "opacity-60" : ""}`}
          >
            <div className={`ring-2 ${medal.ring} rounded-full`}>
              <UserAvatar
                displayName={row.display_name}
                avatarUrl={row.avatar_url}
                avatarCharacterIconUrl={row.avatar_character_icon_url}
                size={index === 0 ? 56 : 44}
              />
            </div>
            <div className="mt-1.5 max-w-[6rem] truncate text-center text-sm font-medium">
              {row.display_name ?? "Unknown"}
              {isLeftMember && (
                <span className="ml-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                  (quit)
                </span>
              )}
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-500">
              🪙 {row.points} pts
            </div>
            <div
              className={`mt-2 flex w-16 items-center justify-center rounded-t-lg bg-black/[.04] text-3xl dark:bg-white/[.06] ${slot.height}`}
            >
              {medal.medal}
            </div>
          </div>
        );
      })}
    </div>
  );
}
