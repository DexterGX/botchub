"use client";

import { useState } from "react";

/**
 * Type-and-press-Enter multi-value input rendered as removable pill chips —
 * used for both "Group code(s)" (Fast Log) and "Players" (Detailed Log).
 * Each committed value becomes its own hidden input sharing `name`, so
 * FormData.getAll(name) on submit returns the full list — the same
 * multi-value-input-under-one-name pattern used for `<select multiple>`
 * elsewhere on the site, just built by hand since these need free-typed
 * values instead of a fixed option list.
 */
export function TagInput({
  name,
  values,
  onChange,
  placeholder,
  uppercase = false,
  suggestions,
}: {
  name: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  /** Group codes read better shouty (matches how invite codes are usually
   * shared); player names shouldn't be forced uppercase. */
  uppercase?: boolean;
  /** Known values to offer as a dropdown while typing (e.g. the groups
   * the signed-in user actually belongs to) — omit for a plain free-typed
   * TagInput like player names, which has no fixed candidate list to
   * suggest from. `value` is what's actually committed as the tag (and
   * matched against `values` for de-duping); `label` is shown in the
   * dropdown and can carry extra context (e.g. "Thursday Crew - D4423")
   * so the code alone doesn't have to do all the identifying. */
  suggestions?: { value: string; label: string }[];
}) {
  const [draft, setDraft] = useState("");
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);

  function commit(raw?: string) {
    const cleaned = (raw ?? draft).trim();
    if (!cleaned) return;
    if (!values.some((v) => v.toLowerCase() === cleaned.toLowerCase())) {
      onChange([...values, cleaned]);
    }
    setDraft("");
    setSuggestionsOpen(false);
  }

  function remove(value: string) {
    onChange(values.filter((v) => v !== value));
  }

  const filteredSuggestions = (suggestions ?? []).filter((s) => {
    if (values.some((v) => v.toLowerCase() === s.value.toLowerCase())) return false;
    const q = draft.trim().toLowerCase();
    return q
      ? s.value.toLowerCase().startsWith(q) || s.label.toLowerCase().includes(q)
      : true;
  });
  const showSuggestions =
    suggestions !== undefined && suggestionsOpen && filteredSuggestions.length > 0;

  return (
    <div className="relative rounded-2xl border border-black/[.12] bg-white p-2 focus-within:border-zinc-400 dark:border-white/[.15] dark:bg-zinc-900">
      {values.map((v) => (
        <input key={v} type="hidden" name={name} value={v} />
      ))}
      <div className="flex flex-wrap gap-1.5">
        {values.map((v) => (
          <span
            key={v}
            className={`inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-700 dark:text-indigo-400 ${uppercase ? "uppercase tracking-wide" : ""}`}
          >
            {v}
            <button
              type="button"
              onClick={() => remove(v)}
              aria-label={`Remove ${v}`}
              className="text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300"
            >
              ✕
            </button>
          </span>
        ))}
        <input
          type="text"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setSuggestionsOpen(true);
          }}
          onFocus={() => setSuggestionsOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              commit();
            } else if (e.key === "Backspace" && draft === "" && values.length > 0) {
              remove(values[values.length - 1]);
            } else if (e.key === "Escape") {
              setSuggestionsOpen(false);
            }
          }}
          onBlur={() => commit()}
          placeholder={values.length === 0 ? placeholder : "Add another…"}
          className="min-w-[8rem] flex-1 bg-transparent px-2 py-1 text-sm outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
        />
      </div>

      {showSuggestions && (
        <div className="absolute inset-x-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-xl border border-black/[.12] bg-white py-1 shadow-lg dark:border-white/[.15] dark:bg-zinc-900">
          {filteredSuggestions.map((s) => (
            <button
              key={s.value}
              type="button"
              // Selecting a suggestion is a mousedown, not a click — it must
              // fire before the input's onBlur (which runs on mousedown-
              // triggered focus loss) commits/clears the draft, or the
              // click never lands on a value that's already gone.
              onMouseDown={(e) => {
                e.preventDefault();
                commit(s.value);
              }}
              className="block w-full px-3 py-1.5 text-left text-sm hover:bg-black/[.04] dark:hover:bg-white/[.06]"
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
