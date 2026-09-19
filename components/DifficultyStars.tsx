// Diego's ask: "Is there a way to sort scripts by level of difficulty?" —
// renders the auto-computed `scripts.difficulty` value (see
// compute_script_difficulty() — base 1 star plus up to 8 independently-
// capped category bonuses, v2) as a row of 1-6 stars in quarter-star
// steps. This is purely a display component; the actual scoring lives in
// the database, computed once at upload time, not here.

const STAR_COUNT = 6;

// A single 5-point star, drawn twice per star slot: a dim outline layer
// (always visible, gives every star its full outline even when 0% filled)
// and a filled layer clipped to `fillPercent` width via overflow-hidden on
// its wrapper — the standard trick for a partial/half star without needing
// a second half-star icon asset.
function StarShape({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden="true">
      <path d="M10 1.5l2.6 5.6 6.1.6-4.6 4.2 1.3 6-5.4-3.2-5.4 3.2 1.3-6-4.6-4.2 6.1-.6z" />
    </svg>
  );
}

function Star({ fillPercent }: { fillPercent: number }) {
  return (
    <span className="relative inline-block h-full w-full shrink-0">
      <StarShape className="h-full w-full fill-zinc-300 dark:fill-zinc-700" />
      {fillPercent > 0 && (
        <span
          className="absolute inset-0 overflow-hidden"
          style={{ width: `${fillPercent}%` }}
        >
          <StarShape className="h-full w-full fill-amber-500" />
        </span>
      )}
    </span>
  );
}

/** 0/25/50/75/100 fill for the star at `index` (0-based) given an overall
 * `difficulty` score — e.g. difficulty=3.75 gives stars 0-2 full (100),
 * star 3 three-quarters (75), stars 4-5 empty (0). Difficulty is stored in
 * quarter-star steps (compute_script_difficulty()'s .25 bonuses), so the
 * remainder only ever lands on one of these five values. */
function fillPercentFor(difficulty: number, index: number): number {
  const remainder = difficulty - index;
  if (remainder >= 1) return 100;
  if (remainder >= 0.75) return 75;
  if (remainder >= 0.5) return 50;
  if (remainder >= 0.25) return 25;
  return 0;
}

export function DifficultyStars({
  difficulty,
  size = "sm",
  className = "",
}: {
  difficulty: number | null;
  /** "sm" (inline with badges/table cells) or "lg" (script detail header). */
  size?: "sm" | "lg";
  className?: string;
}) {
  if (difficulty == null) {
    return (
      <span
        className={`text-xs text-zinc-400 dark:text-zinc-600 ${className}`}
      >
        Difficulty not yet rated
      </span>
    );
  }

  const starSize = size === "lg" ? "h-4 w-4" : "h-3 w-3";

  return (
    <span
      className={`inline-flex items-center gap-0.5 ${className}`}
      title={`Difficulty: ${difficulty.toFixed(2).replace(/0$/, "")} / 6 (auto-estimated — see the script's characters, jinxes, and rules for what drives this)`}
    >
      {Array.from({ length: STAR_COUNT }, (_, i) => (
        <span key={i} className={starSize}>
          <Star fillPercent={fillPercentFor(difficulty, i)} />
        </span>
      ))}
    </span>
  );
}
