"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { editionLabel, SCRIPT_TYPE_LABELS, type ScriptPickerRow } from "@/lib/types";

/** "Script played" field — same searchable portal-modal shape as
 * CharacterPickerField, a flat list instead of grouped since scripts don't
 * have a natural grouping the way characters have teams. Also offers a
 * "+ Script Outside DB" pseudo-option when the typed query doesn't match
 * any real script, so a game can still be logged for a script that isn't
 * (yet) in botchub's library — `externalName`/`onExternalNameChange` carry
 * that freeform choice, mutually exclusive with `value`/`onChange`. */
export function ScriptPickerField({
  scripts,
  value,
  onChange,
  externalName,
  onExternalNameChange,
}: {
  scripts: ScriptPickerRow[];
  value: string | null;
  onChange: (scriptId: string | null) => void;
  externalName: string | null;
  onExternalNameChange: (name: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = scripts.find((s) => s.id === value) ?? null;
  const trimmedQuery = query.trim();

  // Left as a plain computed value (not useMemo) — the React Compiler
  // already memoizes this automatically, and letting it do so avoids
  // fighting the compiler over a manual boundary it can't otherwise
  // preserve once this component grew the external-script-name logic below.
  const q = trimmedQuery.toLowerCase();
  const filtered = !q
    ? scripts
    : scripts.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.author ?? "").toLowerCase().includes(q),
      );

  // Only offer "+ Script Outside DB" once there's something typed that
  // doesn't already exactly match a real script's name (a substring match
  // in `filtered` still leaves room for a script the library genuinely
  // doesn't have).
  const showExternalOption =
    trimmedQuery.length > 0 &&
    !scripts.some((s) => s.name.toLowerCase() === trimmedQuery.toLowerCase());

  function selectRealScript(scriptId: string) {
    onChange(scriptId);
    onExternalNameChange(null);
    setOpen(false);
    setQuery("");
  }

  function selectExternalScript(name: string) {
    onChange(null);
    onExternalNameChange(name);
    setOpen(false);
    setQuery("");
  }

  return (
    <>
      <input type="hidden" name="scriptId" value={value ?? ""} />
      <input
        type="hidden"
        name="externalScriptName"
        value={externalName ?? ""}
      />
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-2xl border border-black/[.12] bg-white px-4 py-2.5 text-left text-sm outline-none transition-colors focus:border-zinc-400 dark:border-white/[.15] dark:bg-zinc-900"
      >
        <span className="text-base">📜</span>
        <span className={selected || externalName ? "" : "text-zinc-500 dark:text-zinc-500"}>
          {selected
            ? selected.name
            : externalName
              ? externalName
              : "Select the script played…"}
        </span>
        {!selected && externalName && (
          <span className="ml-auto shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
            Not in botchub
          </span>
        )}
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
                  placeholder="Search scripts…"
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

              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                {filtered.length === 0 && !showExternalOption ? (
                  <p className="p-4 text-center text-sm text-zinc-500 dark:text-zinc-500">
                    No scripts match.
                  </p>
                ) : (
                  <>
                    {showExternalOption && (
                      <button
                        type="button"
                        onClick={() => selectExternalScript(trimmedQuery)}
                        className={`flex w-full flex-col rounded-lg px-3 py-2 text-left transition-colors ${
                          externalName === trimmedQuery
                            ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                            : "hover:bg-black/[.04] dark:hover:bg-white/[.06]"
                        }`}
                      >
                        <span className="text-sm font-medium">
                          + Script Outside DB: &ldquo;{trimmedQuery}&rdquo;
                        </span>
                        <span className="text-xs text-zinc-500 dark:text-zinc-500">
                          Not in botchub&rsquo;s library — log it under this name anyway
                        </span>
                      </button>
                    )}
                    {filtered.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => selectRealScript(s.id)}
                        className={`flex w-full flex-col rounded-lg px-3 py-2 text-left transition-colors ${
                          value === s.id
                            ? "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400"
                            : "hover:bg-black/[.04] dark:hover:bg-white/[.06]"
                        }`}
                      >
                        <span className="text-sm font-medium">{s.name}</span>
                        <span className="text-xs text-zinc-500 dark:text-zinc-500">
                          {editionLabel(s.edition)} · {SCRIPT_TYPE_LABELS[s.script_type]}
                          {s.author ? ` · ${s.author}` : ""}
                        </span>
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
