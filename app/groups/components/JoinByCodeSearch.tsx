"use client";

import { useState, useTransition } from "react";
import { findGroupByCodeAction, type FindGroupByCodeResult } from "@/lib/group-actions";
import { JoinGroupButton } from "./JoinGroupButton";

const inputClasses =
  "w-full rounded-full border border-black/[.12] bg-white px-4 py-2 text-sm uppercase tracking-wide outline-none focus:border-zinc-400 dark:border-white/[.15] dark:bg-zinc-900";

/** The "search by exact ID#" half of /groups/join — separate from the
 * public-groups browse list below it, since a private group is only
 * reachable this way (find_group_by_code() is the one lookup allowed to
 * see a private group by its exact code; browsing never can). */
export function JoinByCodeSearch() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<FindGroupByCodeResult | null>(null);
  const [searched, setSearched] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSearch() {
    if (!code.trim()) return;
    setSearched(true);
    startTransition(async () => {
      const r = await findGroupByCodeAction(code);
      setResult(r);
    });
  }

  return (
    <div className="rounded-2xl border border-black/[.08] p-5 dark:border-white/[.145]">
      <h2 className="font-semibold">Search by ID#</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Know a group&apos;s code? Look it up directly — this works even for
        private groups.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSearch();
        }}
        className="mt-3 flex gap-2"
      >
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="e.g. D4423"
          maxLength={5}
          className={inputClasses}
        />
        <button
          type="submit"
          disabled={isPending || !code.trim()}
          className="shrink-0 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {isPending ? "Searching…" : "Search"}
        </button>
      </form>

      {searched && !isPending && (
        <div className="mt-4">
          {!result?.group ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-500">
              No group found with that ID#.
            </p>
          ) : (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-black/[.08] p-3 dark:border-white/[.145]">
              <div className="min-w-0">
                <div className="font-medium">{result.group.name}</div>
                {result.group.description && (
                  <p className="truncate text-sm text-zinc-600 dark:text-zinc-400">
                    {result.group.description}
                  </p>
                )}
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-500">
                  {result.group.member_count} member
                  {result.group.member_count === 1 ? "" : "s"} · ID#{" "}
                  {result.group.invite_code}
                </p>
              </div>
              <JoinGroupButton
                groupId={result.group.id}
                visibility={result.group.visibility}
                initialStatus={result.joinStatus}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
