// Mirrors supabase/migrations/20260828000000_initial_schema.sql — keep in sync.

export type Team =
  | "townsfolk"
  | "outsider"
  | "minion"
  | "demon"
  | "traveller"
  | "fabled"
  | "loric";

export type Edition = "tb" | "bmr" | "snv" | null;

export type ScriptType = "full" | "teensyville";

/** A script's character-composition category, distinct from `edition`
 * (which only ever identifies one of the 3 *official* base scripts
 * themselves). Auto-detected at upload time from the script's own
 * characters (see ScriptUploadForm.tsx's client-side heuristic and
 * lib/script-upload-actions.ts's server-side one, which must agree):
 * `homebrew` if it introduces any character not in the official library,
 * `base_three` if every character comes from Trouble Brewing/Bad Moon
 * Rising/Sects & Violets, `custom` otherwise (mixes in official
 * Travellers/Fabled/Loric/Carousel characters but nothing truly
 * homebrew). Always user-overridable before upload. */
export type ScriptCategory = "base_three" | "custom" | "homebrew";

export const SCRIPT_CATEGORY_LABELS: Record<ScriptCategory, string> = {
  base_three: "Base Three",
  custom: "Custom",
  homebrew: "Homebrew Script",
};

/** Formats a count for compact display once it's large enough that the
 * exact figure stops being the point — under 1,500 shows the plain
 * number, at or above it switches to one-decimal "K" (1.5K, 2.1K),
 * trimming a trailing ".0" (2.0K -> 2K). */
export function formatCount(n: number): string {
  if (n < 1500) return String(n);
  if (n < 1_000_000) {
    const k = (n / 1000).toFixed(1).replace(/\.0$/, "");
    return `${k}K`;
  }
  const m = (n / 1_000_000).toFixed(1).replace(/\.0$/, "");
  return `${m}M`;
}

export interface Script {
  id: string;
  owner_id: string | null;
  name: string;
  /** Free-text version label the uploader chooses (e.g. "1.0.0") — purely
   * display metadata, not parsed or validated as real semver. Defaults to
   * "1.0.0" for scripts uploaded before this field existed. */
  version: string;
  category: ScriptCategory;
  description: string | null;
  /** Free-text script-level notes — homebrew/Bootlegger rule clarifications,
   * Fabled/Loric special-rule reminders, house rules, etc. Shown at the top
   * of the Characters section on the script detail page. Distinct from
   * `description` (a short blurb near the title). */
  notes: string | null;
  /** A script's own custom homebrew/house-rule text, from its uploaded
   * JSON's `_meta.bootlegger` array (official script-schema.json field,
   * max 10 entries) — distinct from the Bootlegger character's fixed
   * ability text, which just points here. Null for a script that never
   * had any (most scripts; Bootlegger isn't required to carry rule text
   * even when the character itself is on the script). */
  bootlegger_rules: string[] | null;
  script_json: ScriptJsonEntry[];
  edition: Edition;
  script_type: ScriptType;
  author: string | null;
  view_count: number;
  created_at: string;
  updated_at: string;
}

/** A row from the search_scripts() RPC — a subset of Script's columns (no
 * script_json, since the search results table never needs the full JSON)
 * plus the window-function total_count used for pagination. */
export interface ScriptSearchRow {
  id: string;
  name: string;
  description: string | null;
  edition: Edition;
  script_type: ScriptType;
  author: string | null;
  view_count: number;
  like_count: number;
  created_at: string;
  total_count: number;
}

/** Truncates to a max length on a word boundary, appending an ellipsis —
 * used to keep table rows a consistent height regardless of how long a
 * script's description is. */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

export const SCRIPT_TYPE_LABELS: Record<ScriptType, string> = {
  full: "Full",
  teensyville: "Teensyville",
};

export const SCRIPTS_PAGE_SIZE = 20;

/** How /scripts orders its results — passed straight through to the
 * search_scripts() SQL function's own p_sort parameter (see
 * supabase/migrations/20260916000000_search_scripts_sort.sql and
 * 20260917000000_search_scripts_more_sorts.sql), which does the actual
 * ordering before pagination. Every column but Actions is clickable on
 * the browse table (see /scripts's own nextSortFor/sortDirectionFor) —
 * "newest"/"oldest" are the two that have no column of their own (no
 * "Date" column), reachable instead via the mobile-only Order By select
 * (see SCRIPT_SORT_LABELS below, which supplies that select's option
 * text). */
export type ScriptSortOrder =
  | "newest"
  | "oldest"
  | "name_asc"
  | "name_desc"
  | "author_asc"
  | "author_desc"
  | "type_asc"
  | "type_desc"
  | "most_views"
  | "fewest_views"
  | "most_likes"
  | "fewest_likes";

export const DEFAULT_SCRIPT_SORT: ScriptSortOrder = "newest";

/** Human-readable label for each ScriptSortOrder value, used by the
 * mobile-only "Order By" <select> on /scripts (the sm:hidden fallback for
 * screens too narrow to show the sortable table headers). */
export const SCRIPT_SORT_LABELS: Record<ScriptSortOrder, string> = {
  newest: "Newest first",
  oldest: "Oldest first",
  name_asc: "Name (A → Z)",
  name_desc: "Name (Z → A)",
  author_asc: "Author (A → Z)",
  author_desc: "Author (Z → A)",
  type_asc: "Type (A → Z)",
  type_desc: "Type (Z → A)",
  most_likes: "Most likes",
  fewest_likes: "Fewest likes",
  most_views: "Most views",
  fewest_views: "Fewest views",
};

export interface Character {
  id: string;
  character_id: string;
  name: string;
  team: Team;
  edition: Edition;
  ability: string | null;
  is_homebrew: boolean;
  source_script_id: string | null;
  icon_url: string | null;
  created_at: string;
  /** Official wake-order position on the first night (0 = known not to
   * wake; null = no data yet — see lib/nightOrder.ts for how these two
   * are treated differently). */
  first_night: number | null;
  first_night_reminder: string | null;
  /** Same as first_night, for every night after the first. */
  other_night: number | null;
  other_night_reminder: string | null;
}

// One entry in a script's script_json array: either a bare official
// character id, an inline full character object (homebrew or override), or
// the special "_meta" object carrying script-level metadata.
export type ScriptJsonEntry = string | ScriptJsonCharacter | ScriptJsonMeta;

export interface ScriptJsonCharacter {
  id: string;
  name: string;
  team: Team;
  ability?: string;
  edition?: string;
  [key: string]: unknown;
}

export interface ScriptJsonMeta {
  id: "_meta";
  name?: string;
  author?: string;
  logo?: string;
  [key: string]: unknown;
}

export function isMetaEntry(entry: ScriptJsonEntry): entry is ScriptJsonMeta {
  return typeof entry === "object" && entry.id === "_meta";
}

export function isCharacterObjectEntry(
  entry: ScriptJsonEntry,
): entry is ScriptJsonCharacter {
  return typeof entry === "object" && entry.id !== "_meta";
}

/** The official character id string a script_json entry refers to, if any. */
export function entryCharacterId(entry: ScriptJsonEntry): string | null {
  if (typeof entry === "string") return entry;
  if (isCharacterObjectEntry(entry)) return entry.id;
  return null;
}

const EDITION_LABELS: Record<NonNullable<Edition>, string> = {
  tb: "Trouble Brewing",
  bmr: "Bad Moon Rising",
  snv: "Sects & Violets",
};

export function editionLabel(edition: Edition): string {
  return edition ? (EDITION_LABELS[edition] ?? edition) : "Custom";
}

export const TEAM_ORDER: Team[] = [
  "townsfolk",
  "outsider",
  "minion",
  "demon",
  "traveller",
  "fabled",
  "loric",
];

export const TEAM_LABELS: Record<Team, string> = {
  townsfolk: "Townsfolk",
  outsider: "Outsider",
  minion: "Minion",
  demon: "Demon",
  traveller: "Traveller",
  fabled: "Fabled",
  loric: "Loric",
};
