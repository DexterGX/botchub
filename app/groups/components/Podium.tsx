import type { GroupLeaderboardRow } from "@/lib/types";
import { UserAvatar } from "./UserAvatar";

const PLACE_STYLES = [
  { order: "order-2", height: "h-24", medal: "🥇", ring: "ring-amber-400" },
  { order: "order-1", height: "h-16", medal: "🥈", ring: "ring-zinc-300" },
  { order: "order-3", height: "h-12", medal: "🥉", ring: "ring-orange-400" },
];

/** Top-3 podium above the Players tab's ranked list — Diego's ask, modeled
 * loosely on the Dribbble leaderboard reference he shared, kept small
 * ("no need to be too big") rather than a full illustrated podium. #1
 * renders center via `order-2` regardless of array position, so a
 * 1/2/3-place row always reads left-to-right as 2nd/1st/3rd. */
export function Podium({ rows }: { rows: GroupLeaderboardRow[] }) {
  const top3 = rows.slice(0, 3);
  if (top3.length === 0) return null;

  return (
    <div className="flex items-end justify-center gap-4 pb-2">
      {top3.map((row, index) => {
        const style = PLACE_STYLES[index];
        return (
          <div
            key={row.user_id}
            className={`flex flex-col items-center ${style.order}`}
          >
            <div className={`ring-2 ${style.ring} rounded-full`}>
              <UserAvatar
                displayName={row.display_name}
                avatarUrl={row.avatar_url}
                avatarCharacterIconUrl={row.avatar_character_icon_url}
                size={index === 0 ? 56 : 44}
              />
            </div>
            <div className="mt-1.5 max-w-[6rem] truncate text-center text-sm font-medium">
              {row.display_name ?? "Unknown"}
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-500">
              🪙 {row.points} pts
            </div>
            <div
              className={`mt-2 flex w-16 items-center justify-center rounded-t-lg bg-black/[.04] text-3xl dark:bg-white/[.06] ${style.height}`}
            >
              {style.medal}
            </div>
          </div>
        );
      })}
    </div>
  );
}
