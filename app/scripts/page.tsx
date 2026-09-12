import Link from "next/link";
import { getOfficialCharactersForFilter, searchScripts } from "@/lib/queries";
import {
  SCRIPT_TYPE_LABELS,
  TEAM_ORDER,
  truncate,
  type ScriptType,
} from "@/lib/types";
import { CharacterFilterDropdown } from "./CharacterFilterDropdown";

export const metadata = {
  title: "Browse scripts — BOTChub",
};

interface ScriptsPageSearchParams {
  q?: string;
  type?: string;
  author?: string;
  include?: string | string[];
  exclude?: string | string[];
  page?: string;
}

interface ScriptsPageProps {
  searchParams: Promise<ScriptsPageSearchParams>;
}

/** Next gives a bare string for a single repeated query param and an array
 * for multiple — normalize to an array either way. */
function toArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

/** Builds a query string for a pagination/filter link, keeping every current
 * filter and overriding just the given keys (a `null` override drops that
 * key entirely). No client JS — this is what lets Prev/Next and Clear stay
 * plain `<Link>`s. */
function buildHref(
  params: ScriptsPageSearchParams,
  overrides: Record<string, string | string[] | null>,
): string {
  const qs = new URLSearchParams();
  const merged: Record<string, string | string[] | undefined> = {
    q: params.q,
    type: params.type,
    author: params.author,
    include: params.include,
    exclude: params.exclude,
    page: params.page,
    ...overrides,
  };

  for (const [key, value] of Object.entries(merged)) {
    if (value === null || value === undefined || value === "") continue;
    for (const v of Array.isArray(value) ? value : [value]) {
      qs.append(key, v);
    }
  }

  const qsString = qs.toString();
  return qsString ? `/scripts?${qsString}` : "/scripts";
}

function DownloadIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path
        d="M10 3v9m0 0l-3.5-3.5M10 12l3.5-3.5M4 14.5v.5a2 2 0 002 2h8a2 2 0 002-2v-.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PdfIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path
        d="M6 2.5h5l3 3v9a1.5 1.5 0 01-1.5 1.5h-6.5A1.5 1.5 0 014.5 14.5v-10A1.5 1.5 0 016 2.5z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M11 2.5v3h3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path
        d="M13.5 3.5a1.914 1.914 0 012.707 2.707L6.5 15.914 3 16.5l.586-3.5L13.5 3.5z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className="h-3.5 w-3.5 shrink-0 text-zinc-400 dark:text-zinc-600"
      aria-hidden="true"
    >
      <path
        d="M10 17s-6-4-6-8.5A3.5 3.5 0 0110 6a3.5 3.5 0 016 2.5C16 13 10 17 10 17z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className="h-3.5 w-3.5 shrink-0 text-zinc-400 dark:text-zinc-600"
      aria-hidden="true"
    >
      <path
        d="M1.5 10S4.5 4.5 10 4.5 18.5 10 18.5 10 15.5 15.5 10 15.5 1.5 10 1.5 10z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="10"
        cy="10"
        r="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default async function ScriptsPage({ searchParams }: ScriptsPageProps) {
  const params = await searchParams;
  const q = params.q ?? "";
  const type = (params.type as ScriptType | undefined) || undefined;
  const author = params.author ?? "";
  const include = toArray(params.include);
  const exclude = toArray(params.exclude);
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const [{ scripts, totalCount, totalPages }, characters] = await Promise.all([
    searchScripts({
      q: q || undefined,
      type,
      author: author || undefined,
      includeCharacterIds: include,
      excludeCharacterIds: exclude,
      page,
    }),
    getOfficialCharactersForFilter(),
  ]);

  const charactersByTeam = TEAM_ORDER.map((team) => ({
    team,
    characters: characters.filter((c) => c.team === team),
  })).filter((group) => group.characters.length > 0);

  const hasFilters = Boolean(
    q || type || author || include.length > 0 || exclude.length > 0,
  );

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold">Browse scripts</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {totalCount} script{totalCount === 1 ? "" : "s"}
        {hasFilters ? " matching your filters" : ""}
      </p>

      <form className="mt-6" action="/scripts">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search by script name or description…"
          className="w-full rounded-full border border-black/[.12] bg-white px-5 py-3 text-sm outline-none focus:border-zinc-400 dark:border-white/[.15] dark:bg-zinc-900"
        />

        <div className="mt-4 flex flex-wrap items-start gap-3">
          <select
            name="type"
            defaultValue={type ?? ""}
            className="rounded-full border border-black/[.12] bg-white px-4 py-2 text-sm font-medium text-zinc-700 outline-none dark:border-white/[.15] dark:bg-zinc-900 dark:text-zinc-200"
          >
            <option value="">Game: Any</option>
            <option value="full">Game: {SCRIPT_TYPE_LABELS.full}</option>
            <option value="teensyville">
              Game: {SCRIPT_TYPE_LABELS.teensyville}
            </option>
          </select>

          <input
            type="text"
            name="author"
            defaultValue={author}
            placeholder="Author: any"
            className="w-40 rounded-full border border-black/[.12] bg-white px-4 py-2 text-sm outline-none focus:border-zinc-400 dark:border-white/[.15] dark:bg-zinc-900"
          />

          <CharacterFilterDropdown
            name="include"
            label="Include characters"
            charactersByTeam={charactersByTeam}
            initialSelected={include}
          />
          <CharacterFilterDropdown
            name="exclude"
            label="Exclude characters"
            charactersByTeam={charactersByTeam}
            initialSelected={exclude}
          />

          <button
            type="submit"
            className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
          >
            Filter
          </button>
          {hasFilters && (
            <Link
              href="/scripts"
              className="rounded-full border border-black/[.12] px-5 py-2 text-sm font-medium transition-colors hover:border-zinc-400 dark:border-white/[.15] dark:hover:border-zinc-600"
            >
              Clear
            </Link>
          )}
        </div>
      </form>

      {scripts.length === 0 ? (
        <p className="mt-10 text-sm text-zinc-600 dark:text-zinc-400">
          No scripts match. Try a different search or filter.
        </p>
      ) : (
        <>
          {/* Card list — small screens only. A table forces sideways
              scrolling to read anything past the name column, which is
              painful on a phone, so below the `sm` breakpoint each script
              gets a stacked card instead: name + type on one line, author +
              likes/views on the next, actions along the bottom. */}
          <div className="mt-8 space-y-3 sm:hidden">
            {scripts.map((script) => (
              <div
                key={script.id}
                className="rounded-2xl border border-black/[.08] p-4 dark:border-white/[.145]"
              >
                <div className="flex items-start justify-between gap-3">
                  <Link
                    href={`/scripts/${script.id}`}
                    className="font-medium hover:underline"
                  >
                    {script.name}
                  </Link>
                  <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                    {SCRIPT_TYPE_LABELS[script.script_type]}
                  </span>
                </div>

                {script.description && (
                  <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-500">
                    {truncate(script.description, 90)}
                  </div>
                )}

                <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  by {script.author ?? "—"}
                </div>

                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="flex shrink-0 items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400">
                    <span className="inline-flex items-center gap-1">
                      <HeartIcon />
                      {script.like_count}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <EyeIcon />
                      {script.view_count}
                    </span>
                  </span>

                  <div className="flex items-center gap-2">
                    <a
                      href={`/api/scripts/${script.id}/json`}
                      download={`${script.name}.json`}
                      title="Download script JSON"
                      className="rounded-lg border border-black/[.12] p-2 text-zinc-600 transition-colors hover:border-zinc-400 hover:text-zinc-900 dark:border-white/[.15] dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-50"
                    >
                      <DownloadIcon />
                    </a>
                    <a
                      href={`/api/scripts/${script.id}/pdf`}
                      download={`${script.name}.pdf`}
                      title="Download script PDF"
                      className="rounded-lg border border-black/[.12] p-2 text-zinc-600 transition-colors hover:border-zinc-400 hover:text-zinc-900 dark:border-white/[.15] dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-50"
                    >
                      <PdfIcon />
                    </a>
                    <span
                      title="Editing needs sign-in — coming with script uploads"
                      className="cursor-not-allowed rounded-lg border border-black/[.12] p-2 text-zinc-300 dark:border-white/[.15] dark:text-zinc-700"
                    >
                      <EditIcon />
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Table — sm and up. */}
          <div className="mt-8 hidden overflow-x-auto rounded-2xl border border-black/[.08] dark:border-white/[.145] sm:block">
            <table className="w-full min-w-[720px] table-fixed text-left text-sm">
              <colgroup>
                <col className="w-[34%]" />
                <col className="w-[20%]" />
                <col className="w-[12%]" />
                <col className="w-[10%]" />
                <col className="w-[10%]" />
                <col className="w-[14%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-black/[.08] text-xs uppercase tracking-wide text-zinc-500 dark:border-white/[.145] dark:text-zinc-500">
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Author</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Likes</th>
                  <th className="px-4 py-3 font-semibold">Views</th>
                  <th className="px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {scripts.map((script) => (
                  <tr
                    key={script.id}
                    className="border-b border-black/[.06] align-top last:border-0 hover:bg-black/[.02] dark:border-white/[.08] dark:hover:bg-white/[.03]"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/scripts/${script.id}`}
                        className="font-medium hover:underline"
                      >
                        {script.name}
                      </Link>
                      {script.description && (
                        <div className="mt-0.5 overflow-hidden text-xs text-zinc-500 dark:text-zinc-500">
                          {truncate(script.description, 70)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {script.author ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {SCRIPT_TYPE_LABELS[script.script_type]}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      <span className="inline-flex items-center gap-1">
                        <HeartIcon />
                        {script.like_count}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      <span className="inline-flex items-center gap-1">
                        <EyeIcon />
                        {script.view_count}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <a
                          href={`/api/scripts/${script.id}/json`}
                          download={`${script.name}.json`}
                          title="Download script JSON"
                          className="rounded-lg border border-black/[.12] p-1.5 text-zinc-600 transition-colors hover:border-zinc-400 hover:text-zinc-900 dark:border-white/[.15] dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-50"
                        >
                          <DownloadIcon />
                        </a>
                        <a
                          href={`/api/scripts/${script.id}/pdf`}
                          download={`${script.name}.pdf`}
                          title="Download script PDF"
                          className="rounded-lg border border-black/[.12] p-1.5 text-zinc-600 transition-colors hover:border-zinc-400 hover:text-zinc-900 dark:border-white/[.15] dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-50"
                        >
                          <PdfIcon />
                        </a>
                        <span
                          title="Editing needs sign-in — coming with script uploads"
                          className="cursor-not-allowed rounded-lg border border-black/[.12] p-1.5 text-zinc-300 dark:border-white/[.15] dark:text-zinc-700"
                        >
                          <EditIcon />
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-4 text-sm">
          {page > 1 ? (
            <Link
              href={buildHref(params, { page: String(page - 1) })}
              className="rounded-full border border-black/[.12] px-4 py-2 font-medium transition-colors hover:border-zinc-400 dark:border-white/[.15] dark:hover:border-zinc-600"
            >
              ← Prev
            </Link>
          ) : (
            <span className="cursor-not-allowed rounded-full border border-black/[.12] px-4 py-2 font-medium text-zinc-400 dark:border-white/[.15] dark:text-zinc-600">
              ← Prev
            </span>
          )}

          <span className="text-zinc-500 dark:text-zinc-400">
            Page {page} of {totalPages}
          </span>

          {page < totalPages ? (
            <Link
              href={buildHref(params, { page: String(page + 1) })}
              className="rounded-full border border-black/[.12] px-4 py-2 font-medium transition-colors hover:border-zinc-400 dark:border-white/[.15] dark:hover:border-zinc-600"
            >
              Next →
            </Link>
          ) : (
            <span className="cursor-not-allowed rounded-full border border-black/[.12] px-4 py-2 font-medium text-zinc-400 dark:border-white/[.15] dark:text-zinc-600">
              Next →
            </span>
          )}
        </div>
      )}
    </main>
  );
}
