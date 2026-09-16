"use client";

/**
 * A checkbox styled as a filled pill rather than a native checkbox square —
 * used for Storyteller / Storyteller mistakes? / Final 3 reached?. Carries
 * its value into the surrounding <form> as a hidden "true"/"false" input
 * (game-actions.ts reads it with `=== "true"`), since a real unchecked
 * checkbox simply omits itself from FormData, which is harder to tell apart
 * from "field doesn't exist on this form" than an explicit value is.
 */
export function ToggleChip({
  name,
  label,
  checked,
  onChange,
  activeClassName = "border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-400",
}: {
  name: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  activeClassName?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
        checked
          ? activeClassName
          : "border-black/[.12] text-zinc-600 hover:border-zinc-400 dark:border-white/[.15] dark:text-zinc-400 dark:hover:border-zinc-600"
      }`}
    >
      <input type="hidden" name={name} value={checked ? "true" : "false"} />
      <span
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-current text-[10px] leading-none`}
      >
        {checked && "✓"}
      </span>
      {label}
    </button>
  );
}
