"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { TEAM_LABELS, TEAM_ORDER, type Character } from "@/lib/types";

/**
 * "Your character" field — a searchable, grouped-by-team picker in a
 * portal modal, the same shape as the account page's AvatarPicker (search
 * input added on top, since this list is being searched rather than just
 * browsed). A portal modal rather than an anchored dropdown for the same
 * reason AvatarPicker uses one: nothing clips it and nothing constrains
 * which direction it opens, which matters most on a phone-width form.
 */
export function CharacterPickerField({
  characters,
  value,
  onChange,
  disabled,
}: {
  characters: Character[];
  value: string | null;
  onChange: (characterId: string | null) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = characters.find((c) => c.id === value) ?? null;

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? characters.filter((c) => c.name.toLowerCase().includes(q))
      : characters;
    return TEAM_ORDER.map((team) => ({
      team,
      characters: filtered.filter((c) => c.team === team),
    })).filter((g) => g.characters.length > 0);
  }, [characters, query]);

  return (
    <>
      <input type="hidden" name="characterId" value={value ?? ""} />
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-2xl border border-black/[.12] bg-white px-4 py-2.5 text-left text-sm outline-none transition-colors focus:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[.15] dark:bg-zinc-900"
      >
        {selected?.icon_url ? (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <Image
              src={selected.icon_url}
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 object-contain"
            />
          </span>
        ) : (
          <span className="text-base">🎭</span>
        )}
        <span className={selected ? "" : "text-zinc-500 dark:text-zinc-500"}>
          {selected ? selected.name : "Select your character…"}
        </span>
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => setOpen(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="flex max-h-[80vh] w-full max-w-sm flex-col overflow-hidden rounded-xl border border-black/[.12] bg-white shadow-xl dark:border-white/[.15] dark:bg-zinc-900"
            >
              <div className="flex items-center gap-2 border-b border-black/[.08] p-3 dark:border-white/[.1]">
                <input
                  autoFocus
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search characters…"
                  className="flex-1 rounded-full border border-black/[.12] bg-white px-3 py-1.5 text-sm outline-none focus:border-zinc-400 dark:border-white/[.15] dark:bg-zinc-900"
                />
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="shrink-0 rounded-full p-1.5 text-zinc-500 hover:bg-black/[.04] dark:text-zinc-400 dark:hover:bg-white/[.06]"
                >
                  ✕
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                {grouped.length === 0 ? (
                  <p className="p-4 text-center text-sm text-zinc-500 dark:text-zinc-500">
                    No characters match.
                  </p>
                ) : (
                  grouped.map((group) => (
                    <div key={group.team} className="mb-3">
                      <div className="px-1 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-600">
                        {TEAM_LABELS[group.team]}
                      </div>
                      <div className="grid grid-cols-1 gap-1">
                        {group.characters.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              onChange(c.id);
                              setOpen(false);
                              setQuery("");
                            }}
                            className={`flex items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
                              value === c.id
                                ? "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400"
                                : "hover:bg-black/[.04] dark:hover:bg-white/[.06]"
                            }`}
                          >
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                              {c.icon_url ? (
                                <Image
                                  src={c.icon_url}
                                  alt=""
                                  width={32}
                                  height={32}
                                  className="h-8 w-8 object-contain"
                                />
                              ) : (
                                <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-600">
                                  {c.name.slice(0, 1)}
                                </span>
                              )}
                            </span>
                            {c.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
