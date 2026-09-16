import Image from "next/image";
import { DURATION_OPTIONS, type GameHistoryRow } from "@/lib/types";

const DURATION_LABELS = Object.fromEntries(
  DURATION_OPTIONS.map((o) => [o.value, o.label]),
);

/** Middle-dot separator between pieces of info on the same line — used in
 * the character/result row below (e.g. "Merlin (Good) · WON · ST mistakes
 * noted"), matching the " · " convention already used elsewhere on the
 * site (e.g. the script detail page's byline row). */
function Dot() {
  return (
    <span aria-hidden="true" className="text-zinc-400 dark:text-zinc-600">
      ·
    </span>
  );
}

/** The win/lost (or, for the Storyteller, which team won) result shown as
 * a small bordered "frame" — Diego's ask was to make this read like a
 * game-over banner ("YOU WIN") rather than a plain word. */
function ResultBadge({
  label,
  tone,
}: {
  label: string;
  tone: "win" | "loss" | "good" | "evil";
}) {
  const toneClass = {
    win: "border-emerald-600/50 bg-emerald-500/15 text-emerald-700 dark:border-emerald-500/50 dark:text-emerald-400",
    loss: "border-rose-600/50 bg-rose-500/15 text-rose-700 dark:border-rose-500/50 dark:text-rose-400",
    good: "border-blue-600/50 bg-blue-500/15 text-blue-700 dark:border-blue-500/50 dark:text-blue-400",
    evil: "border-rose-600/50 bg-rose-500/15 text-rose-700 dark:border-rose-500/50 dark:text-rose-400",
  }[tone];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-lg border-2 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${toneClass}`}
    >
      {label}
    </span>
  );
}

/** One logged game — the shared card used by both /games/history (the
 * full, paginated list) and the Account Overview "recent games" widget,
 * so the two never drift in look. */
export function GameHistoryCard({ game }: { game: GameHistoryRow }) {
  const resultClass = game.self_is_storyteller
    ? "border-purple-600/30"
    : game.self_won === true
      ? "border-emerald-600/30"
      : game.self_won === false
        ? "border-rose-600/30"
        : "border-black/[.08] dark:border-white/[.145]";

  return (
    <li className={`rounded-2xl border-[3px] p-4 ${resultClass}`}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">
            {game.script_name ?? "Unknown script"}
          </span>
          {!game.script_id && game.external_script_name && (
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
              Not in botchub
            </span>
          )}
          {game.log_type === "detailed" && (
            <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-xs font-medium text-purple-700 dark:text-purple-400">
              Detailed
            </span>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          {game.self_is_storyteller ? (
            <span className="inline-flex items-center gap-1 font-medium text-purple-700 dark:text-purple-400">
              🎩 Storyteller
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              {game.self_character_icon_url && (
                <Image
                  src={game.self_character_icon_url}
                  alt=""
                  width={18}
                  height={18}
                  className="h-[18px] w-[18px] object-contain"
                />
              )}
              {game.self_character_name ?? "—"}
              {game.self_team && (
                <span
                  className={
                    game.self_team === "good"
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-rose-600 dark:text-rose-400"
                  }
                >
                  ({game.self_team === "good" ? "Good" : "Evil"})
                </span>
              )}
            </span>
          )}

          {/* Storyteller has no personal win/loss, but the game itself
              still has a winning side — show that instead of dropping
              the result entirely. */}
          {!game.self_is_storyteller && game.self_won !== null && (
            <>
              <Dot />
              <ResultBadge
                label={game.self_won ? "🏆 Won" : "💀 Lost"}
                tone={game.self_won ? "win" : "loss"}
              />
            </>
          )}

          {game.self_is_storyteller && game.winning_team && (
            <>
              <Dot />
              <ResultBadge
                label={game.winning_team === "good" ? "Good Won" : "Evil Won"}
                tone={game.winning_team}
              />
            </>
          )}

          {game.storyteller_mistakes && (
            <>
              <Dot />
              <span className="text-amber-600 dark:text-amber-400">
                ST mistakes noted
              </span>
            </>
          )}
        </div>

        {game.duration && (
          <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              Time:
            </span>{" "}
            {DURATION_LABELS[game.duration]}
          </p>
        )}

        {game.notes && (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              Notes:
            </span>{" "}
            {game.notes}
          </p>
        )}

        {game.group_codes.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {game.group_codes.map((code) => (
              <span
                key={code}
                className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-indigo-700 dark:text-indigo-400"
              >
                {code}
              </span>
            ))}
          </div>
        )}

        <div className="mt-3 flex justify-end">
          <time
            dateTime={game.played_at}
            className="text-xs text-zinc-400 dark:text-zinc-600"
          >
            {new Date(game.played_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </time>
        </div>
      </div>
    </li>
  );
}
