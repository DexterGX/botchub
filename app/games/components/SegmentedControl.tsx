"use client";

/**
 * A single-select row of pill buttons standing in for a native <select> —
 * Diego specifically didn't want the game-log form to look like the plain
 * native dropdowns elsewhere on the site (e.g. the character-reference
 * edition filter). Carries its value into the surrounding <form> via a
 * hidden input rather than real radio inputs, since the colored pill *is*
 * the input — no separate visible control needed.
 */
export function SegmentedControl<T extends string>({
  name,
  options,
  value,
  onChange,
  disabled,
  selectedClassName = "border-foreground bg-foreground text-background",
}: {
  name: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
  disabled?: boolean;
  /** Classes applied to the selected pill in place of the default
   * black/white treatment — used for Good/Evil so they read as blue/rose
   * instead of monochrome. */
  selectedClassName?: string;
}) {
  return (
    <div className={`flex flex-wrap gap-2 ${disabled ? "opacity-50" : ""}`}>
      <input type="hidden" name={name} value={value ?? ""} />
      {options.map((opt) => {
        const isSelected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            aria-pressed={isSelected}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${
              isSelected
                ? selectedClassName
                : "border-black/[.12] text-zinc-600 hover:border-zinc-400 dark:border-white/[.15] dark:text-zinc-400 dark:hover:border-zinc-600"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
