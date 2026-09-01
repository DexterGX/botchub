import Image from "next/image";
import Link from "next/link";
import { searchCharacters } from "@/lib/queries";
import {
  TEAM_LABELS,
  TEAM_ORDER,
  editionLabel,
  type Edition,
  type Team,
} from "@/lib/types";

export const metadata = {
  title: "Character reference — botchub",
};

const EDITION_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Any edition" },
  { value: "tb", label: "Trouble Brewing" },
  { value: "bmr", label: "Bad Moon Rising" },
  { value: "snv", label: "Sects & Violets" },
  { value: "homebrew", label: "Homebrew" },
];

interface CharactersPageProps {
  searchParams: Promise<{ q?: string; team?: string; edition?: string }>;
}

export default async function CharactersPage({
  searchParams,
}: CharactersPageProps) {
  const { q, team, edition } = await searchParams;

  const characters = await searchCharacters({
    q,
    team: team as Team | undefined,
    edition: (edition as Edition | "homebrew" | undefined) || undefined,
  });

  const byTeam = TEAM_ORDER.map((t) => ({
    team: t,
    characters: characters.filter((c) => c.team === t),
  })).filter((group) => group.characters.length > 0);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold">Character reference</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {characters.length} character{characters.length === 1 ? "" : "s"}
      </p>

      <form className="mt-6 flex flex-wrap gap-3" action="/characters">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search by name or ability…"
          className="min-w-0 flex-1 rounded-full border border-black/[.12] bg-white px-4 py-2 text-sm outline-none focus:border-zinc-400 dark:border-white/[.15] dark:bg-zinc-900"
        />
        <select
          name="team"
          defaultValue={team ?? ""}
          className="rounded-full border border-black/[.12] bg-white px-4 py-2 text-sm outline-none focus:border-zinc-400 dark:border-white/[.15] dark:bg-zinc-900"
        >
          <option value="">Any team</option>
          {TEAM_ORDER.map((t) => (
            <option key={t} value={t}>
              {TEAM_LABELS[t]}
            </option>
          ))}
        </select>
        <select
          name="edition"
          defaultValue={edition ?? ""}
          className="rounded-full border border-black/[.12] bg-white px-4 py-2 text-sm outline-none focus:border-zinc-400 dark:border-white/[.15] dark:bg-zinc-900"
        >
          {EDITION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
        >
          Filter
        </button>
        {(q || team || edition) && (
          <Link
            href="/characters"
            className="rounded-full border border-black/[.12] px-5 py-2 text-sm font-medium transition-colors hover:border-zinc-400 dark:border-white/[.15] dark:hover:border-zinc-600"
          >
            Clear
          </Link>
        )}
      </form>

      {characters.length === 0 ? (
        <p className="mt-10 text-sm text-zinc-600 dark:text-zinc-400">
          No characters match. Try a different search or filter.
        </p>
      ) : (
        <div className="mt-8 space-y-8">
          {byTeam.map((group) => (
            <div key={group.team}>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
                {TEAM_LABELS[group.team]}
              </h2>
              <ul className="mt-3 grid gap-4 sm:grid-cols-2">
                {group.characters.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-start gap-3 rounded-2xl border border-black/[.08] p-4 dark:border-white/[.145]"
                  >
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                      {c.icon_url ? (
                        <Image
                          src={c.icon_url}
                          alt=""
                          width={40}
                          height={40}
                          className="h-10 w-10 object-contain"
                        />
                      ) : (
                        <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-600">
                          {c.name.slice(0, 1)}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-medium">{c.name}</span>
                        <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-600">
                          {c.is_homebrew ? "Homebrew" : editionLabel(c.edition)}
                        </span>
                      </div>
                      {c.ability && (
                        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                          {c.ability}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
