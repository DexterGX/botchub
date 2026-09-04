// The "General" landing tab's stats. Every number here is a placeholder —
// script uploads (Phase 4) and game tracking (Phase 7) don't exist yet, so
// there is no real count or role split to show. Per the same rule the
// original 3 KPI tiles were built with: render an honest "—", never a
// fabricated 0% or an evenly-split pie that looks like real data. The role
// "donut" below is deliberately uncolored for that reason — coloring five
// even slices would read as a real breakdown of games that were never
// played.

const ROLE_TEAMS = ["Townsfolk", "Outsider", "Minion", "Demon", "Traveller"];

function StatTile({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-2 py-4">
      <span className="text-lg font-semibold text-zinc-300 dark:text-zinc-700">
        —
      </span>
      <span className="text-center text-xs text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
    </div>
  );
}

function RoleDonutPlaceholder() {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const segment = circumference / ROLE_TEAMS.length;
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

export function StatsOverview() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Overview
        </h2>
        <div className="mt-3 grid grid-cols-3 divide-x divide-black/[.08] rounded-2xl border border-black/[.08] dark:divide-white/[.08] dark:border-white/[.145]">
          <StatTile label="Scripts" />
          <StatTile label="Games played" />
          <StatTile label="Win rate" />
        </div>
        <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-600">
          Fills in as script uploads and game tracking go live.
        </p>
      </div>

      <div className="rounded-2xl border border-black/[.08] p-5 dark:border-white/[.145]">
        <h3 className="text-sm font-semibold">Role breakdown</h3>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          Which teams you get assigned most, once game tracking is live.
        </p>

        <div className="mt-4 flex items-center gap-6">
          <RoleDonutPlaceholder />
          <ul className="flex-1 space-y-1.5 text-sm">
            {ROLE_TEAMS.map((team) => (
              <li
                key={team}
                className="flex items-center justify-between gap-2 text-zinc-600 dark:text-zinc-400"
              >
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                  {team}
                </span>
                <span className="text-zinc-400 dark:text-zinc-600">—</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
