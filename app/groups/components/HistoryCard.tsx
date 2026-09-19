import Image from "next/image";
import type { GroupHistoryRow } from "@/lib/types";

/** One thin per-player-per-game row for the History tab — Diego's exact
 * spec: "Player Name - Character - Good/Evil Team - Result", script name
 * and date kept close underneath to stay slim, background tinted by the
 * result.
 *
 * `self_is_storyteller` on the RPC row is a property of the *game*
 * (whether whoever logged it was running it), not of this row — a game
 * where the Storyteller also typed in Detailed Log player names produces
 * one row per named player, each carrying `self_is_storyteller: true`
 * alongside real player_display_name/character/team data. So a row only
 * gets the "Storyteller" treatment when it has no player of its own
 * (`player_display_name`/`player_user_id` both null) — the pseudo-row a
 * Fast-Log Storyteller-only game produces when there's no game_players
 * row at all. A player row with a null team/won is a free-text
 * Detailed-Log player (see GameLogForm's "Players" field — name only, no
 * team/result captured yet), shown plainly rather than guessing a
 * result. */
export function HistoryCard({ row }: { row: GroupHistoryRow }) {
  const isPlayerRow = row.player_user_id !== null || row.player_display_name !== null;

  const bgClass = !isPlayerRow
    ? "border-purple-600/40 bg-purple-500/15 dark:bg-purple-500/20"
    : row.won === true
      ? "border-emerald-600/40 bg-emerald-500/15 dark:bg-emerald-500/20"
      : row.won === false
        ? "border-rose-600/40 bg-rose-500/15 dark:bg-rose-500/20"
        : "border-black/[.08] dark:border-white/[.145]";

  return (
    <li className={`rounded-xl border p-3 ${bgClass}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5 text-sm">
          {!isPlayerRow ? (
            <span className="font-medium text-purple-700 dark:text-purple-400">
              🎩 {row.storyteller_display_name ?? "Unknown"} — Storyteller
            </span>
          ) : (
            <>
              {row.character_icon_url && (
                <Image
                  src={row.character_icon_url}
                  alt=""
                  width={20}
                  height={20}
                  className="h-5 w-5 shrink-0 rounded-full bg-black/[.06] object-contain dark:bg-white/[.08]"
                />
              )}
              <span className="font-medium">
                {row.player_display_name ?? "Unknown"}
                {row.character_name && (
                  <span className="text-zinc-600 dark:text-zinc-400">
                    {" "}
                    — {row.character_name}
                  </span>
                )}
                {row.team && (
                  <span
                    className={
                      row.team === "good"
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-rose-600 dark:text-rose-400"
                    }
                  >
                    {" "}
                    ({row.team === "good" ? "Good" : "Evil"})
                  </span>
                )}
                {row.won !== null && (
                  <span
                    className={
                      row.won
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-rose-700 dark:text-rose-400"
                    }
                  >
                    {" "}
                    — {row.won ? "Won" : "Lost"}
                  </span>
                )}
              </span>
            </>
          )}
        </div>
        <time
          dateTime={row.played_at}
          className="shrink-0 text-xs text-zinc-400 dark:text-zinc-600"
        >
          {new Date(row.played_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </time>
      </div>
      <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-500">
        Script: {row.script_name ?? "Unknown script"}
      </div>
    </li>
  );
}
