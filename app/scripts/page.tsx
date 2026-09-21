import Link from "next/link";
import { Suspense } from "react";
import {
  getLikedScriptIds,
  getOfficialCharactersForFilter,
  searchScripts,
} from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_SCRIPT_SORT,
  DIFFICULTY_FILTER_OPTIONS,
  SCRIPT_SORT_LABELS,
  SCRIPT_TYPE_LABELS,
  TEAM_ORDER,
  truncate,
  type ScriptSortOrder,
  type ScriptType,
} from "@/lib/types";
import { AutoApplyFilterForm } from "./AutoApplyFilterForm";
import { CharacterFilterDropdown } from "./CharacterFilterDropdown";
import { DifficultyStars } from "@/components/DifficultyStars";
import { LikeButton } from "./LikeButton";
import { SearchBox, SearchBoxFallback } from "./SearchBox";

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
  sort?: string;
  difficulty?: string;
}

const VALID_SORTS: readonly ScriptSortOrder[] = [
  "newest",
  "oldest",
  "name_asc",
  "name_desc",
  "author_asc",
  "author_desc",
  "type_asc",
  "type_desc",
  "most_views",
  "fewest_views",
  "most_likes",
  "fewest_likes",
  "most_difficult",
  "least_difficult",
];

/** Display order for the mobile "Order By" <select> — Newest/Oldest first
 * (the two with no column of their own), then each sortable column's
 * ascending/descending pair in the same left-to-right order the table
 * shows them (Name, Author, Type, Likes, Views). Distinct from
 * VALID_SORTS above, which only needs to validate, not present nicely. */
const SORT_SELECT_ORDER: readonly ScriptSortOrder[] = [
  "newest",
  "oldest",
  "name_asc",
  "name_desc",
  "author_asc",
  "author_desc",
  "type_asc",
  "type_desc",
  "most_likes",
  "fewest_likes",
  "most_views",
  "fewest_views",
  "most_difficult",
  "least_difficult",
];

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
    sort: params.sort,
    difficulty: params.difficulty,
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

type SortColumn = "name" | "author" | "difficulty" | "type" | "likes" | "views";

/** Every sortable column's asc/desc sort values plus which direction a
 * *first* click on that column should land on — text columns (Name/
 * Author/Type) start ascending (A→Z reads naturally first), while the
 * numeric columns (Likes/Views) keep their original highest-first default.
 * "newest"/"oldest" have no column of their own (no Date column) — they're
 * reachable only via the mobile Order By pills below. */
const SORT_COLUMN_VALUES: Record<
  SortColumn,
  { asc: ScriptSortOrder; desc: ScriptSortOrder; firstClick: "asc" | "desc" }
> = {
  name: { asc: "name_asc", desc: "name_desc", firstClick: "asc" },
  author: { asc: "author_asc", desc: "author_desc", firstClick: "asc" },
  difficulty: {
    asc: "least_difficult",
    desc: "most_difficult",
    firstClick: "desc",
  },
  type: { asc: "type_asc", desc: "type_desc", firstClick: "asc" },
  likes: { asc: "fewest_likes", desc: "most_likes", firstClick: "desc" },
  views: { asc: "fewest_views", desc: "most_views", firstClick: "desc" },
};

/** Which sort value a click on a sortable column header should go to
 * next. First click on a column goes to that column's `firstClick`
 * direction; a second click on the same column flips it; clicking a
 * different column always starts that column over at its own
 * `firstClick` direction, regardless of what was active before. */
function nextSortFor(
  current: ScriptSortOrder,
  column: SortColumn,
): ScriptSortOrder {
  const { asc, desc, firstClick } = SORT_COLUMN_VALUES[column];
  if (current === asc) return desc;
  if (current === desc) return asc;
  return firstClick === "asc" ? asc : desc;
}

/** The direction a column header is currently sorted by, or null when
 * neither of that column's two sort values is active — drives both the
 * arrow's rotation and whether it's shown in "active" color. */
function sortDirectionFor(
  current: ScriptSortOrder,
  column: SortColumn,
): "asc" | "desc" | null {
  const { asc, desc } = SORT_COLUMN_VALUES[column];
  if (current === asc) return "asc";
  if (current === desc) return "desc";
  return null;
}

/** Small chevron used on a sortable column header — points down by
 * default (matching "highest first" being the default direction), flips
 * to point up for "asc", and sits dim/gray until that column is the
 * active sort so it still reads as a hover affordance rather than noise. */
function SortArrow({ direction }: { direction: "asc" | "desc" | null }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      className={`h-3 w-3 shrink-0 transition-transform ${
        direction === "asc" ? "rotate-180" : ""
      } ${
        direction
          ? "text-zinc-700 dark:text-zinc-200"
          : "text-zinc-300 dark:text-zinc-700"
      }`}
      aria-hidden="true"
    >
      <path d="M5 7.5l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
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
  const sort = VALID_SORTS.includes(params.sort as ScriptSortOrder)
    ? (params.sort as ScriptSortOrder)
    : DEFAULT_SCRIPT_SORT;
  const parsedDifficulty = params.difficulty
    ? Number(params.difficulty)
    : NaN;
  const minDifficulty = DIFFICULTY_FILTER_OPTIONS.some(
    (opt) => opt.value === parsedDifficulty,
  )
    ? parsedDifficulty
    : undefined;

  const supabase = await createClient();
  const [
    {
      data: { user },
    },
    { scripts, totalCount, totalPages },
    characters,
  ] = await Promise.all([
    supabase.auth.getUser(),
    searchScripts({
      q: q || undefined,
      type,
      author: author || undefined,
      includeCharacterIds: include,
      excludeCharacterIds: exclude,
      page,
      sort,
      minDifficulty,
    }),
    getOfficialCharactersForFilter(),
  ]);

  // One query for every liked/not-liked state on this page, rather than
  // one per row — cheap since a page is at most SCRIPTS_PAGE_SIZE scripts.
  const likedIds = user
    ? await getLikedScriptIds(
        user.id,
        scripts.map((s) => s.id),
      )
    : new Set<string>();

  const charactersByTeam = TEAM_ORDER.map((team) => ({
    team,
    characters: characters.filter((c) => c.team === team),
  })).filter((group) => group.characters.length > 0);

  const hasFilters = Boolean(
    q ||
      type ||
      author ||
      include.length > 0 ||
      exclude.length > 0 ||
      minDifficulty !== undefined ||
      sort !== DEFAULT_SCRIPT_SORT,
  );

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold">Browse scripts</h1>
      <div className="mt-1 flex items-center justify-between gap-3">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {totalCount} script{totalCount === 1 ? "" : "s"}
          {hasFilters ? " matching your filters" : ""}
        </p>
        <Link
          href="/scripts/new"
          className="shrink-0 rounded-full bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          + Upload script
        </Link>
      </div>

      {/* Below `sm`, every control goes full-width in a 2-column grid
          (Author+Game, Include+Exclude, Order By, Clear) instead of the
          single-file stack a plain flex-wrap row produces on a narrow
          screen — `sm:contents` on each grouping wrapper below then
          dissolves it back into the normal flex-wrap row at `sm:` and up,
          where these pills have always fit several to a line. On `sm` and
          up, sorting instead lives on the clickable column headers below
          — the mobile-only "Order By" <select> further down doubles as
          that sort value's carrier at every width (see its own comment),
          so there's no separate hidden input for it here. Every field
          here applies itself (see AutoApplyFilterForm) — there's no
          Filter button to click anymore. */}
      <AutoApplyFilterForm className="mt-6">
        <Suspense fallback={<SearchBoxFallback initialValue={q} />}>
          <SearchBox initialValue={q} />
        </Suspense>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-start">
          <input
            type="text"
            name="author"
            defaultValue={author}
            placeholder="Author: any"
            className="w-full rounded-full border border-black/[.12] bg-white px-4 py-2 text-sm outline-none sm:w-40 dark:border-white/[.15] dark:bg-zinc-900"
          />

          <select
            name="type"
            defaultValue={type ?? ""}
            className="w-full rounded-full border border-black/[.12] bg-white px-4 py-2 text-sm font-medium text-zinc-700 outline-none sm:w-auto dark:border-white/[.15] dark:bg-zinc-900 dark:text-zinc-200"
          >
            <option value="">Game: Any</option>
            <option value="full">Game: {SCRIPT_TYPE_LABELS.full}</option>
            <option value="teensyville">
              Game: {SCRIPT_TYPE_LABELS.teensyville}
            </option>
          </select>

          <div className="col-span-2 grid grid-cols-2 gap-3 sm:contents">
            <CharacterFilterDropdown
              name="include"
              label="Include characters"
              charactersByTeam={charactersByTeam}
              initialSelected={include}
              className="w-full sm:w-auto"
            />
            <CharacterFilterDropdown
              name="exclude"
              label="Exclude characters"
              charactersByTeam={charactersByTeam}
              initialSelected={exclude}
              className="w-full sm:w-auto"
            />
          </div>

          {/* Difficulty floor — sits directly above "Order By" per
              Diego's ask, at every breakpoint: full-width on its own row
              on mobile (col-span-2, matching Order By's own span), a
              normal pill among the others on sm+. "1+" is omitted since
              every script is already >= 1 star (see
              DIFFICULTY_FILTER_OPTIONS), so it'd be indistinguishable
              from "Any". */}
          <select
            name="difficulty"
            defaultValue={minDifficulty !== undefined ? String(minDifficulty) : ""}
            className="col-span-2 w-full rounded-full border border-black/[.12] bg-white px-4 py-2 text-sm font-medium text-zinc-700 outline-none sm:col-span-1 sm:w-auto dark:border-white/[.15] dark:bg-zinc-900 dark:text-zinc-200"
          >
            <option value="">Difficulty: Any</option>
            {DIFFICULTY_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                Difficulty: {opt.label}
              </option>
            ))}
          </select>

          {/* Mobile-only — the table's clickable column headers (Name/
              Author/Difficulty/Type/Likes/Views) don't exist in the card
              layout below `sm`, so this <select> is the only way to reach
              a non-default sort on a phone, styled to match the Game
              <select> above per Diego's request. It's also the "sort"
              field for the *whole* form, at every width, not just when
              visible: `sm:hidden` on this wrapper only changes CSS
              display, so at `sm` and up the select still sits in the DOM
              (with its value pinned to the sort currently active via
              header-link clicks) and still submits/auto-applies normally
              — a hidden form field doesn't need the `hidden` HTML
              attribute to be included, just a `name`. That's what lets
              AutoApplyFilterForm carry the active sort through on any
              other field's change, without a second, separately-named
              hidden input (which would have collided with this select's
              own `name="sort"` and sent two values for one param). */}
          <div className="col-span-2 flex items-center gap-2 sm:hidden">
            <label
              htmlFor="mobile-sort"
              className="shrink-0 text-sm font-medium text-zinc-600 dark:text-zinc-400"
            >
              Order By:
            </label>
            <select
              id="mobile-sort"
              name="sort"
              defaultValue={sort}
              className="w-full flex-1 rounded-full border border-black/[.12] bg-white px-4 py-2 text-sm font-medium text-zinc-700 outline-none dark:border-white/[.15] dark:bg-zinc-900 dark:text-zinc-200"
            >
              {SORT_SELECT_ORDER.map((value) => (
                <option key={value} value={value}>
                  {SCRIPT_SORT_LABELS[value]}
                </option>
              ))}
            </select>
          </div>

          {hasFilters && (
            <div className="col-span-2 sm:contents">
              <Link
                href="/scripts"
                className="block rounded-full border border-black/[.12] px-5 py-2 text-center text-sm font-medium transition-colors hover:border-zinc-400 sm:inline-block sm:w-auto dark:border-white/[.15] dark:hover:border-zinc-600"
              >
                Clear
              </Link>
            </div>
          )}
        </div>
      </AutoApplyFilterForm>

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
                    {script.name}{" "}
                    <span className="font-normal text-zinc-500 dark:text-zinc-500">
                      v{script.version}
                    </span>
                  </Link>
                  <span className="flex shrink-0 flex-col items-end gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {SCRIPT_TYPE_LABELS[script.script_type]}
                    <DifficultyStars difficulty={script.difficulty} />
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
                    <LikeButton
                      scriptId={script.id}
                      initialLiked={likedIds.has(script.id)}
                      initialCount={script.like_count}
                      isLoggedIn={Boolean(user)}
                    />
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
                    {user && script.owner_id === user.id ? (
                      <Link
                        href={`/scripts/${script.id}/edit`}
                        title="Edit script"
                        className="rounded-lg border border-black/[.12] p-2 text-zinc-600 transition-colors hover:border-zinc-400 hover:text-zinc-900 dark:border-white/[.15] dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-50"
                      >
                        <EditIcon />
                      </Link>
                    ) : (
                      <span
                        title={
                          user
                            ? "Only the script's uploader can edit it"
                            : "Log in to edit your own scripts"
                        }
                        className="cursor-not-allowed rounded-lg border border-black/[.12] p-2 text-zinc-300 dark:border-white/[.15] dark:text-zinc-700"
                      >
                        <EditIcon />
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Table — sm and up. */}
          <div className="mt-8 hidden overflow-x-auto rounded-2xl border border-black/[.08] dark:border-white/[.145] sm:block">
            <table className="w-full min-w-[720px] table-fixed text-left text-sm">
              <colgroup>
                <col className="w-[26%]" />
                <col className="w-[16%]" />
                <col className="w-[14%]" />
                <col className="w-[11%]" />
                <col className="w-[10%]" />
                <col className="w-[10%]" />
                <col className="w-[13%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-black/[.08] text-xs uppercase tracking-wide text-zinc-500 dark:border-white/[.145] dark:text-zinc-500">
                  <th className="px-4 py-3 font-semibold">
                    <Link
                      href={buildHref(params, {
                        sort: nextSortFor(sort, "name"),
                        page: null,
                      })}
                      className="inline-flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-200"
                    >
                      Name
                      <SortArrow direction={sortDirectionFor(sort, "name")} />
                    </Link>
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    <Link
                      href={buildHref(params, {
                        sort: nextSortFor(sort, "author"),
                        page: null,
                      })}
                      className="inline-flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-200"
                    >
                      Author
                      <SortArrow
                        direction={sortDirectionFor(sort, "author")}
                      />
                    </Link>
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    {/* The label needs to sit centered over the column's
                        (also centered) body content, independent of the
                        arrow — either put the arrow in normal flow next to
                        the label (drags the *pair* off-center, Diego's
                        first report) or float it near the label (still
                        reads as "inside" the centered block, Diego's
                        second report). This pins the arrow to the cell's
                        own right edge instead — a fixed side decoration —
                        while the label centers on its own via the Link's
                        `justify-center`, unaffected by the arrow's width. */}
                    <Link
                      href={buildHref(params, {
                        sort: nextSortFor(sort, "difficulty"),
                        page: null,
                      })}
                      className="relative flex items-center justify-center hover:text-zinc-900 dark:hover:text-zinc-200"
                    >
                      Difficulty
                      <span className="absolute right-0 top-1/2 -translate-y-1/2">
                        <SortArrow
                          direction={sortDirectionFor(sort, "difficulty")}
                        />
                      </span>
                    </Link>
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    <Link
                      href={buildHref(params, {
                        sort: nextSortFor(sort, "type"),
                        page: null,
                      })}
                      className="relative flex items-center justify-center hover:text-zinc-900 dark:hover:text-zinc-200"
                    >
                      Type
                      <span className="absolute right-0 top-1/2 -translate-y-1/2">
                        <SortArrow direction={sortDirectionFor(sort, "type")} />
                      </span>
                    </Link>
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    <Link
                      href={buildHref(params, {
                        sort: nextSortFor(sort, "likes"),
                        page: null,
                      })}
                      className="relative flex items-center justify-center hover:text-zinc-900 dark:hover:text-zinc-200"
                    >
                      Likes
                      <span className="absolute right-0 top-1/2 -translate-y-1/2">
                        <SortArrow direction={sortDirectionFor(sort, "likes")} />
                      </span>
                    </Link>
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    <Link
                      href={buildHref(params, {
                        sort: nextSortFor(sort, "views"),
                        page: null,
                      })}
                      className="relative flex items-center justify-center hover:text-zinc-900 dark:hover:text-zinc-200"
                    >
                      Views
                      <span className="absolute right-0 top-1/2 -translate-y-1/2">
                        <SortArrow direction={sortDirectionFor(sort, "views")} />
                      </span>
                    </Link>
                  </th>
                  <th className="px-4 py-3 text-center font-semibold">
                    Actions
                  </th>
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
                        {script.name}{" "}
                        <span className="font-normal text-zinc-500 dark:text-zinc-500">
                          v{script.version}
                        </span>
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
                    <td className="px-4 py-3 text-center">
                      <DifficultyStars
                        difficulty={script.difficulty}
                        layout="stacked"
                      />
                    </td>
                    <td className="px-4 py-3 text-center text-zinc-600 dark:text-zinc-400">
                      {SCRIPT_TYPE_LABELS[script.script_type]}
                    </td>
                    <td className="px-4 py-3 text-center text-zinc-600 dark:text-zinc-400">
                      <LikeButton
                        scriptId={script.id}
                        initialLiked={likedIds.has(script.id)}
                        initialCount={script.like_count}
                        isLoggedIn={Boolean(user)}
                      />
                    </td>
                    <td className="px-4 py-3 text-center text-zinc-600 dark:text-zinc-400">
                      <span className="inline-flex items-center gap-1">
                        <EyeIcon />
                        {script.view_count}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
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
                        {user && script.owner_id === user.id ? (
                          <Link
                            href={`/scripts/${script.id}/edit`}
                            title="Edit script"
                            className="rounded-lg border border-black/[.12] p-1.5 text-zinc-600 transition-colors hover:border-zinc-400 hover:text-zinc-900 dark:border-white/[.15] dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-50"
                          >
                            <EditIcon />
                          </Link>
                        ) : (
                          <span
                            title={
                              user
                                ? "Only the script's uploader can edit it"
                                : "Log in to edit your own scripts"
                            }
                            className="cursor-not-allowed rounded-lg border border-black/[.12] p-1.5 text-zinc-300 dark:border-white/[.15] dark:text-zinc-700"
                          >
                            <EditIcon />
                          </span>
                        )}
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
