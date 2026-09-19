import type { Group } from "@/lib/types";

function Row({
  label,
  points,
  mistakePoints,
  colorClass,
}: {
  label: string;
  points: number;
  mistakePoints: number;
  colorClass: string;
}) {
  const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`);
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-black/[.08] p-3 dark:border-white/[.145]">
      <span className="font-medium">{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${colorClass}`}>
        🪙 {sign(points)} pts
        {mistakePoints !== points && (
          <span className="ml-2 text-xs font-normal text-zinc-500 dark:text-zinc-500">
            ({sign(mistakePoints)} if ST mistake noted)
          </span>
        )}
      </span>
    </li>
  );
}

/** The Rules tab — the group's description, plus a plain-language readout
 * of its points config, per Diego's spec ("the points summary for players
 * so they know what are the rules for the group"). The description lives
 * here rather than on the main group header, since it's part of "the
 * rules" for the group, not identifying info like the name/ID#. Read-only
 * here; the owner edits it by re-creating the group for now, since no
 * group-settings edit page exists yet — same "v1 doesn't need everything"
 * scoping as elsewhere in this feature. */
export function RulesPanel({ group }: { group: Group }) {
  const anyRule =
    group.count_wins || group.count_losses || group.count_storyteller;

  return (
    <div>
      {group.description && (
        <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
          {group.description}
        </p>
      )}

      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        How points are earned in this group.
      </p>

      {!anyRule ? (
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-500">
          This group doesn&apos;t count anything toward points yet.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {group.count_wins && (
            <Row
              label="Win"
              points={group.win_points}
              mistakePoints={group.win_points_mistake}
              colorClass="text-emerald-700 dark:text-emerald-400"
            />
          )}
          {group.count_losses && (
            <Row
              label="Loss"
              points={group.loss_points}
              mistakePoints={group.loss_points_mistake}
              colorClass="text-rose-700 dark:text-rose-400"
            />
          )}
          {group.count_storyteller && (
            <Row
              label="Storyteller"
              points={group.storyteller_points}
              mistakePoints={group.storyteller_points_mistake}
              colorClass="text-purple-700 dark:text-purple-400"
            />
          )}
        </ul>
      )}
    </div>
  );
}
