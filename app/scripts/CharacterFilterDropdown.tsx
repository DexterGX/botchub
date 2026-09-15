"use client";

import { useEffect, useRef, useState } from "react";
import { TEAM_LABELS, type Character, type Team } from "@/lib/types";

/** A "Series: Any ▾"-style filter button that expands into a searchable,
 * checkbox list grouped by team. This is a client component (search input,
 * click-outside-to-close, and a live selected count all need real state),
 * but the selection itself is still plain HTML checkboxes with name/value
 * set, so the enclosing <form> submits them the normal way — no fetch, no
 * client-side routing.
 *
 * Important: every checkbox stays mounted in the DOM at all times (search
 * and open/closed state only toggle CSS visibility, never unmount them).
 * If a checked box were removed from the DOM — say, filtered out by a
 * search term, or the panel closing — the browser wouldn't include it in
 * the form submission at all, silently dropping that selection. */
export function CharacterFilterDropdown({
  name,
  label,
  charactersByTeam,
  initialSelected,
  className,
}: {
  name: "include" | "exclude";
  label: string;
  charactersByTeam: { team: Team; characters: Character[] }[];
  initialSelected: string[];
  /** Extra classes on the outer (positioning) wrapper — e.g. "w-full
   * sm:w-auto" so the toggle button can go full-width in a mobile grid
   * layout while staying its normal shrink-to-fit size on wider screens
   * (the button itself is already `w-full` of whatever this wrapper is). */
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initialSelected),
  );
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function toggle(characterId: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(characterId);
      } else {
        next.delete(characterId);
      }
      return next;
    });
  }

  const normalizedQuery = query.trim().toLowerCase();
  const hasAnyMatch = charactersByTeam.some((group) =>
    group.characters.some((c) =>
      c.name.toLowerCase().includes(normalizedQuery),
    ),
  );

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-full border border-black/[.12] bg-white px-4 py-2 text-sm font-medium text-zinc-700 outline-none dark:border-white/[.15] dark:bg-zinc-900 dark:text-zinc-200"
      >
        <span className="inline-flex items-center gap-1.5">
          {label}:{" "}
          <span className="font-normal text-zinc-500 dark:text-zinc-400">
            {selected.size > 0 ? `${selected.size} selected` : "Any"}
          </span>
        </span>
        <ChevronIcon />
      </button>

      {/* Backdrop — mobile only. The panel itself switches from an
          absolute popover anchored to its own button (sm: and up) to a
          fixed, viewport-centered one below `sm` (see its own comment) —
          this dims the page behind it so that centered placement reads as
          a deliberate modal rather than a stray floating box, and gives a
          second, more obvious way to dismiss it than the existing
          click-outside listener. */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          aria-hidden="true"
          className="fixed inset-0 z-20 bg-black/40 sm:hidden"
        />
      )}

      {/* Below `sm`, this panel is fixed and centered in the viewport
          (translate-based centering, both axes) instead of being
          absolutely positioned off its own trigger button — anchoring to
          the button was overflowing off the right edge of the screen
          whenever that button sat in the right column of the mobile 2-col
          filter grid (Exclude characters), since a 16rem-wide popover
          doesn't fit between that button's left edge and the viewport
          edge. `sm:` and up restores the original anchored-popover
          behavior unchanged. */}
      <div
        className={`fixed left-1/2 top-1/2 z-30 max-h-[70vh] w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-black/[.12] bg-white shadow-lg dark:border-white/[.15] dark:bg-zinc-900 sm:absolute sm:left-0 sm:top-auto sm:z-20 sm:mt-2 sm:w-64 sm:max-w-none sm:max-h-none sm:translate-x-0 sm:translate-y-0 ${
          open ? "" : "hidden"
        }`}
      >
        <div className="border-b border-black/[.08] p-2 dark:border-white/[.1]">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search characters…"
            className="w-full rounded-lg border border-black/[.12] bg-white px-3 py-1.5 text-sm outline-none focus:border-zinc-400 dark:border-white/[.15] dark:bg-zinc-950"
          />
        </div>

        <div className="max-h-64 overflow-y-auto p-2">
          {charactersByTeam.map((group) => (
            <div key={group.team} className="mb-1">
              <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-600">
                {TEAM_LABELS[group.team]}
              </div>
              {group.characters.map((c) => {
                const matches = c.name.toLowerCase().includes(normalizedQuery);
                return (
                  <label
                    key={c.id}
                    className={`flex items-center gap-2 rounded-lg px-2 py-1 text-sm text-zinc-700 hover:bg-black/[.04] dark:text-zinc-200 dark:hover:bg-white/[.06] ${
                      matches ? "" : "hidden"
                    }`}
                  >
                    <input
                      type="checkbox"
                      name={name}
                      value={c.character_id}
                      checked={selected.has(c.character_id)}
                      onChange={(e) => toggle(c.character_id, e.target.checked)}
                      className="rounded border-zinc-300 dark:border-zinc-600"
                    />
                    {c.name}
                  </label>
                );
              })}
            </div>
          ))}
          {!hasAnyMatch && (
            <p className="px-2 py-4 text-center text-sm text-zinc-400 dark:text-zinc-600">
              No characters match &quot;{query}&quot;.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ChevronIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className="h-3.5 w-3.5 shrink-0"
      aria-hidden="true"
    >
      <path d="M5 7.5l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
