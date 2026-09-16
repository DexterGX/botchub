import Link from "next/link";
import {
  ROLE_BREAKDOWN_TEAMS,
  TEAM_DOT_COLORS,
  TEAM_LABELS,
  type GameHistoryRow,
  type GameStats,
  type RoleBreakdownTeam,
} from "@/lib/types";
import { GameHistoryCard } from "@/app/games/components/GameHistoryCard";

/** "—", not "0%", when there's no data yet to compute a rate from — same
 * rule GameStats.winRate/goodWinRate/evilWinRate already encode as `null`
 * rather than 0. */
function formatRate(rate: number | null): string {
  return rate === null ? "—" : `${Math.round(rate * 100)}%`;
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-2 py-4">
      <span className="text-lg font-semibold">{value}</span>
      <span className="text-center text-xs text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
    </div>
  );
}

/** The neutral, uncolored ring shown when there's no role data yet —
 * coloring five even slices would read as a real breakdown of games that
 * were never played. */
function RoleDonutPlaceholder() {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const segment = circumference / ROLE_BREAKDOWN_TEAMS.length;
  const gap = 4;

  return (
    <svg
      width="104"
      height="104"
      viewBox="0 0 104 104"
      className="shrink-0"
      role="img"
      aria-label="Role breakdown not available yet"
    >
      <circle
        cx="52"
        cy="52"
        r={radius}
        fill="none"
        strokeWidth="14"
        className="stroke-zinc-100 dark:stroke-zinc-800"
      />
      <circle
        cx="52"
        cy="52"
        r={radius}
        fill="none"
        strokeWidth="14"
        strokeDasharray={`${segment - gap} ${gap}`}
        strokeLinecap="round"
        className="stroke-zinc-300 dark:stroke-zinc-700"
        transform="rotate(-90 52 52)"
      />
    </svg>
  );
}

/** The real donut, once at least one role-breakdown game exists — one arc
 * per team with a plays count, sized by its share of the total and
 * colored via TEAM_DOT_COLORS, same strokeDasharray/rotate technique the
 * placeholder above uses. */
function RoleDonut({
  roleBreakdown,
  total,
}: {
  roleBreakdown: Partial<Record<RoleBreakdownTeam, number>>;
  total: number;
}) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const gap = 3;

  // Built with a pure fold (no mutated accumulator variable) — each step
  // returns a new { results, offset } pair rather than reassigning a
  // shared `cursor`, since the latter trips the React Compiler's
  // immutability check on a value read during render.
  const segments = ROLE_BREAKDOWN_TEAMS.reduce<{
    results: { team: RoleBreakdownTeam; start: number; length: number }[];
    offset: number;
  }>(
    (acc, team) => {
      const count = roleBreakdown[team] ?? 0;
      const rawLength = (count / total) * circumference;
      const length = Math.max(rawLength - gap, 0);
      const results =
        length > 0
          ? [...acc.results, { team, start: acc.offset, length }]
          : acc.results;
      return { results, offset: acc.offset + rawLength };
    },
    { results: [], offset: 0 },
  ).results;

  return (
    <svg
      width="104"
      height="104"
      viewBox="0 0 104 104"
      className="shrink-0"
      role="img"
      aria-label="Role breakdown"
    >
      <circle
        cx="52"
        cy="52"
        r={radius}
        fill="none"
        strokeWidth="14"
        className="stroke-zinc-100 dark:stroke-zinc-800"
      />
      {segments.map(({ team, start, length }) => (
        <circle
          key={team}
          cx="52"
          cy="52"
          r={radius}
          fill="none"
          strokeWidth="14"
          strokeDasharray={`${length} ${circumference - length}`}
          strokeDashoffset={-start}
          strokeLinecap="round"
          className={TEAM_DOT_COLORS[team].stroke}
          transform="rotate(-90 52 52)"
        />
      ))}
    </svg>
  );
}

export function StatsOverview({
  scriptsCount,
  stats,
  recentGames,
}: {
  scriptsCount: number;
  stats: GameStats;
  recentGames: GameHistoryRow[];
}) {
  const roleTotal = ROLE_BREAKDOWN_TEAMS.reduce(
    (sum, team) => sum + (stats.roleBreakdown[team] ?? 0),
    0,
  );

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Overview
        </h2>
        {/* Two rows of 3, each with its own `divide-x` — a single 6-item
            `grid-cols-3 divide-x` would also draw a stray left border on
            the first tile of row 2, since Tailwind's divide utilities key
            off DOM order, not grid row. Wrapping each row in its own div
            and putting `divide-y` on the shared outer border keeps the
            single-row-of-3 look correct on both rows. */}
        <div className="mt-3 divide-y divide-black/[.08] rounded-2xl border border-black/[.08] dark:divide-white/[.08] dark:border-white/[.145]">
          <div className="grid grid-cols-3 divide-x divide-black/[.08] dark:divide-white/[.08]">
            <StatTile label="Overall WR" value={formatRate(stats.winRate)} />
            <StatTile label="Good WR" value={formatRate(stats.goodWinRate)} />
            <StatTile label="Evil WR" value={formatRate(stats.evilWinRate)} />
          </div>
          <div className="grid grid-cols-3 divide-x divide-black/[.08] dark:divide-white/[.08]">
            <StatTile label="Games played" value={String(stats.gamesPlayed)} />
            <StatTile
              label="Storyteller games"
              value={String(stats.storytellerGames)}
            />
            <StatTile label="Scripts uploaded" value={String(scriptsCount)} />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-black/[.08] p-5 dark:border-white/[.145]">
        <h3 className="text-sm font-semibold">Role breakdown</h3>

        <div className="mt-4 flex items-center gap-6">
          {roleTotal > 0 ? (
            <RoleDonut roleBreakdown={stats.roleBreakdown} total={roleTotal} />
          ) : (
            <RoleDonutPlaceholder />
          )}
          <ul className="flex-1 space-y-1.5 text-sm">
            {ROLE_BREAKDOWN_TEAMS.map((team) => {
              const count = stats.roleBreakdown[team] ?? 0;
              return (
                <li
                  key={team}
                  className="flex items-center justify-between gap-2 text-zinc-600 dark:text-zinc-400"
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        roleTotal > 0
                          ? TEAM_DOT_COLORS[team].dot
                          : "bg-zinc-300 dark:bg-zinc-700"
                      }`}
                    />
                    {TEAM_LABELS[team]}
                  </span>
                  <span className="text-zinc-400 dark:text-zinc-600">
                    {roleTotal > 0
                      ? `${Math.round((count / roleTotal) * 100)}%`
                      : "—"}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Recent games
          </h3>
          {stats.gamesPlayed > 0 && (
            <Link
              href="/games/history"
              className="text-xs font-medium text-zinc-600 hover:underline dark:text-zinc-400"
            >
              View all →
            </Link>
          )}
        </div>

        {recentGames.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            No games logged yet —{" "}
            <Link href="/games" className="font-medium underline">
              log your first one
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {recentGames.map((game) => (
              <GameHistoryCard key={game.id} game={game} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
