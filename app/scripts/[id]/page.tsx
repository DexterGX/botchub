import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCharactersForScript,
  getScriptById,
  incrementScriptViewCount,
} from "@/lib/queries";
import { buildNightOrder, type NightOrderEntry } from "@/lib/nightOrder";
import { buildScriptToolUrl } from "@/lib/scriptTool";
import {
  TEAM_LABELS,
  TEAM_ORDER,
  editionLabel,
  isMetaEntry,
  type ScriptJsonMeta,
} from "@/lib/types";

interface ScriptPageProps {
  params: Promise<{ id: string }>;
}

// Every other page has its own descriptive title (see the metadata export
// on the sibling pages) — this one used to inherit the root layout's
// generic default instead, so every script's browser tab read the same
// "BOTChub — Blood on the Clocktower scripts" no matter which script you
// were looking at. A missing script here isn't treated as an error — the
// page component's own notFound() call handles that and Next.js renders
// its own not-found title in that case.
export async function generateMetadata({
  params,
}: ScriptPageProps): Promise<Metadata> {
  const { id } = await params;
  const script = await getScriptById(id);
  if (!script) return {};
  return { title: `${script.name} — BOTChub` };
}

export default async function ScriptDetailPage({ params }: ScriptPageProps) {
  const { id } = await params;

  const script = await getScriptById(id);
  if (!script) notFound();

  // Best-effort — a failed view-count bump should never break the page.
  incrementScriptViewCount(id).catch(() => {});

  const characters = await getCharactersForScript(id);
  const meta = script.script_json.find(isMetaEntry) as
    ScriptJsonMeta | undefined;
  const author = meta?.author;

  const byTeam = TEAM_ORDER.map((team) => ({
    team,
    characters: characters.filter((c) => c.team === team),
  })).filter((group) => group.characters.length > 0);

  const { firstNight, otherNight, missingData } = buildNightOrder(characters);

  const jsonUrl = `/api/scripts/${script.id}/json`;
  const scriptToolUrl = buildScriptToolUrl(script.script_json);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      <Link
        href="/scripts"
        className="text-sm text-zinc-600 hover:underline dark:text-zinc-400"
      >
        ← All scripts
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {script.name}
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {editionLabel(script.edition)}
            {author ? ` · by ${author}` : ""} · {script.view_count} view
            {script.view_count === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      {script.description && (
        <p className="mt-4 text-zinc-700 dark:text-zinc-300">
          {script.description}
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <a
          href={scriptToolUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
        >
          Open Script Tool ↗
        </a>
        <a
          href={jsonUrl}
          download={`${script.name}.json`}
          className="rounded-full border border-black/[.12] px-5 py-2 text-sm font-medium transition-colors hover:border-zinc-400 dark:border-white/[.15] dark:hover:border-zinc-600"
        >
          Download JSON
        </a>
        <a
          href={`/api/scripts/${script.id}/pdf`}
          download={`${script.name}.pdf`}
          className="rounded-full border border-black/[.12] px-5 py-2 text-sm font-medium transition-colors hover:border-zinc-400 dark:border-white/[.15] dark:hover:border-zinc-600"
        >
          Download PDF
        </a>
      </div>
      <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-600">
        &quot;Open Script Tool&quot; pre-loads this script&apos;s characters
        directly on script.bloodontheclocktower.com, the same way it works from
        other script libraries.
      </p>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Characters</h2>
        {script.notes && (
          <div className="mt-4 rounded-lg border border-black/[.12] bg-zinc-50 px-4 py-3 dark:border-white/[.15] dark:bg-zinc-900">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
              Notes
            </h3>
            <p className="mt-1 whitespace-pre-line text-sm text-zinc-700 dark:text-zinc-300">
              {script.notes}
            </p>
          </div>
        )}
        <div className="mt-4 space-y-6">
          {byTeam.map(({ team, characters: teamCharacters }) => (
            <div key={team}>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
                {TEAM_LABELS[team]}
              </h3>
              {/* This isn't just a plain 2-col grid: a bare `grid-cols-2`
                  defaults to row-major auto-placement (item 1 top-left,
                  item 2 top-right, item 3 second row...), so a reader
                  scanning left-to-right sees pairs interleaved from what's
                  visually the "left" and "right" column. The generated PDF
                  (lib/scriptPdf.tsx's splitColumnsBalanced) instead reads
                  each column as a contiguous top-to-bottom slice — the
                  first half of the list down the left column, then the
                  rest down the right — which is also the standard printed
                  character-sheet convention. That mismatch was the actual
                  bug Diego reported ("script starts washerwoman, gossip,
                  pixie, but the website shows washerwoman, pixie, sailor")
                  once the underlying array order itself became consistent
                  (see supabase/migrations/20260913010000_script_character_position.sql)
                  — both surfaces were reading the identical ordered data,
                  they just laid it into two columns differently. Setting
                  `grid-auto-flow: column` with an explicit row count makes
                  the grid fill top-to-bottom down column 1 first, matching
                  the PDF's reading order (an even split here rather than
                  the PDF's weight-balanced one, but the split point matters
                  far less than which direction the columns read). Only
                  applied at `sm:` and up — below that it's a single column
                  already, where reading order isn't in question. */}
              <ul
                className="mt-2 grid gap-x-6 gap-y-3 sm:grid-cols-2 sm:[grid-auto-flow:column] sm:[grid-template-rows:repeat(var(--team-rows),minmax(0,1fr))]"
                style={
                  {
                    "--team-rows": Math.ceil(teamCharacters.length / 2),
                  } as React.CSSProperties
                }
              >
                {teamCharacters.map((c) => (
                  <li key={c.id} className="flex items-start gap-3">
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
                    <div>
                      <div className="font-medium">
                        {c.name}
                        {c.is_homebrew && (
                          <span className="ml-2 rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-normal text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                            Homebrew
                          </span>
                        )}
                      </div>
                      {c.ability && (
                        <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
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
      </section>

      <section className="mt-10">
        {/* Collapsed by default (no `open` attribute) — a native <details>
            disclosure rather than a client-side toggle, so it needs no JS
            and stays keyboard/screen-reader accessible for free. Most
            visitors are here for the character list, not the wake-order
            reference, so this keeps the page shorter until someone actually
            wants it. */}
        <details>
          <summary className="cursor-pointer text-lg font-semibold marker:text-zinc-400 dark:marker:text-zinc-600">
            Night order
          </summary>
          {firstNight.length === 0 && otherNight.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              No character on this script has night-order data yet.
            </p>
          ) : (
            <div className="mt-4 grid gap-8 sm:grid-cols-2">
              <NightOrderList title="First night" entries={firstNight} />
              <NightOrderList title="Other nights" entries={otherNight} />
            </div>
          )}
          {missingData.length > 0 && (
            <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-500">
              {missingData.length === 1
                ? `${missingData[0].name} doesn't`
                : `${missingData.map((c) => c.name).join(", ")} don't`}{" "}
              have night-order data in BOTChub yet — check the printed script
              or Script Tool for exact placement.
            </p>
          )}
        </details>
      </section>
    </main>
  );
}

function NightOrderList({
  title,
  entries,
}: {
  title: string;
  entries: NightOrderEntry[];
}) {
  if (entries.length === 0) {
    return (
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
          {title}
        </h3>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-500">
          No characters on this script act on {title.toLowerCase()}.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
        {title}
      </h3>
      <ol className="mt-2 space-y-3">
        {entries.map((entry, i) => (
          <li key={entry.key} className="flex items-start gap-3">
            <span className="mt-0.5 w-4 shrink-0 text-right text-xs tabular-nums text-zinc-400 dark:text-zinc-600">
              {i + 1}
            </span>
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
              {entry.iconUrl ? (
                <Image
                  src={entry.iconUrl}
                  alt=""
                  width={28}
                  height={28}
                  className="h-7 w-7 object-contain"
                />
              ) : (
                <span className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-600">
                  {entry.name.slice(0, 1)}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium">{entry.name}</div>
              {entry.reminder && (
                <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
                  {entry.reminder}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
