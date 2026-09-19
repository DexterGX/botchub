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
  /** Auto-computed 1-6 (quarter-star) difficulty estimate — see
   * compute_script_difficulty() (supabase/migrations/
   * 20260918000003_script_difficulty_rating.sql through
   * *_search_scripts_difficulty.sql, plus the v2 rework in
   * *_script_difficulty_rating_v2*.sql). Null for a script uploaded before
   * this existed, until it's re-saved. */
  difficulty: number | null;
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
  difficulty: number | null;
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

/** Options for the /scripts "Difficulty" browse filter — whole-star
 * minimums only (not every quarter-star step) to keep the <select> short;
 * "1+" is left out since every script is at least 1 star, making it
 * equivalent to "Any". Passed straight through as search_scripts()'s
 * p_min_difficulty. */
export const DIFFICULTY_FILTER_OPTIONS: readonly {
  value: 2 | 3 | 4 | 5;
  label: string;
}[] = [
  { value: 2, label: "2+ stars" },
  { value: 3, label: "3+ stars" },
  { value: 4, label: "4+ stars" },
  { value: 5, label: "5+ stars" },
];

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
  | "fewest_likes"
  | "most_difficult"
  | "least_difficult";

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
  most_difficult: "Most difficult",
  least_difficult: "Least difficult",
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

// --- Track your games (Phase 7) -------------------------------------------
// Mirrors supabase/migrations/*_game_logging_fields.sql — keep in sync.

export type Alignment = "good" | "evil";

export const ALIGNMENT_LABELS: Record<Alignment, string> = {
  good: "Good",
  evil: "Evil",
};

export type LogType = "fast" | "detailed";

export type Duration =
  | "under_45"
  | "from_45_to_90"
  | "from_90_to_135"
  | "over_135";

/** Ordered for display — a plain Record loses insertion order once you
 * iterate its keys in some tooling, so callers that need the fixed left-
 * to-right order (the duration pill row) should map over this, not
 * Object.keys(DURATION_LABELS). */
export const DURATION_OPTIONS: { value: Duration; label: string }[] = [
  { value: "under_45", label: "Under 45 min" },
  { value: "from_45_to_90", label: "45 min – 1h30" },
  { value: "from_90_to_135", label: "1h30 – 2h15" },
  { value: "over_135", label: "2h15+" },
];

export type LastPhase = "day" | "night";

export const LAST_PHASE_LABELS: Record<LastPhase, string> = {
  day: "Day",
  night: "Night",
};

/** A lightweight script row for the "Script played" picker — just enough
 * to search and display by, not the full Script (script_json included)
 * that a script detail page needs. */
export interface ScriptPickerRow {
  id: string;
  name: string;
  author: string | null;
  edition: Edition;
  script_type: ScriptType;
}

export interface Game {
  id: string;
  created_by: string;
  script_id: string | null;
  /** Freeform script name entered via "+ Script Outside DB" when the played
   * script isn't in botchub's scripts table. Mutually exclusive with
   * script_id — exactly one of the two should be set. */
  external_script_name: string | null;
  played_at: string;
  log_type: LogType;
  self_is_storyteller: boolean;
  winning_team: Alignment | null;
  storyteller_mistakes: boolean;
  duration: Duration | null;
  final_three: boolean | null;
  last_phase: LastPhase | null;
  last_phase_number: number | null;
  notes: string | null;
  created_at: string;
}

export interface GamePlayer {
  id: string;
  game_id: string;
  user_id: string | null;
  display_name: string | null;
  character_id: string | null;
  team: Alignment | null;
  won: boolean | null;
}

/** One row of /games/history — a game plus the pieces of it that only
 * live in related tables (the script's name, the logging user's own
 * character/alignment/result, if any). Built by joining in
 * getMyGamesPage() rather than shaping a generic nested type here. */
export interface GameHistoryRow extends Game {
  script_name: string | null;
  self_character_name: string | null;
  self_character_icon_url: string | null;
  self_team: Alignment | null;
  self_won: boolean | null;
  group_codes: string[];
}

export const GAMES_PAGE_SIZE = 10;

/** The teams a "role breakdown" actually means — Fabled/Loric are
 * Storyteller-side rule modifiers, not roles a player is assigned, so a
 * played-character count for either would be a data-quality signal (a bad
 * character-team row) rather than a real category worth its own slice. */
export type RoleBreakdownTeam =
  | "townsfolk"
  | "outsider"
  | "minion"
  | "demon"
  | "traveller";

export const ROLE_BREAKDOWN_TEAMS: RoleBreakdownTeam[] = [
  "townsfolk",
  "outsider",
  "minion",
  "demon",
  "traveller",
];

/** Tailwind classes for the Account Overview role-breakdown donut/legend —
 * one distinguishable hue per team, loosely following the site's existing
 * good=blue/evil=red convention (see lib/scriptPdf.tsx's nameColorFor)
 * while still giving Townsfolk/Outsider and Minion/Demon their own shade
 * so all five read apart in a legend. */
export const TEAM_DOT_COLORS: Record<
  RoleBreakdownTeam,
  { dot: string; stroke: string }
> = {
  townsfolk: { dot: "bg-blue-500", stroke: "stroke-blue-500" },
  outsider: { dot: "bg-sky-400", stroke: "stroke-sky-400" },
  minion: { dot: "bg-amber-500", stroke: "stroke-amber-500" },
  demon: { dot: "bg-rose-600", stroke: "stroke-rose-600" },
  traveller: { dot: "bg-purple-500", stroke: "stroke-purple-500" },
};

/** Account Overview's "Games played"/"Win rate"/role-breakdown numbers,
 * computed from the signed-in user's own logged games — see
 * getMyGameStats() in lib/queries.ts. */
export interface GameStats {
  gamesPlayed: number;
  /** Games where the user played an assigned character (excludes games
   * where they were the Storyteller, who has no personal win/loss). */
  gamesWithResult: number;
  wins: number;
  /** null, not 0, when gamesWithResult is 0 — there is no rate to show
   * yet, and 0% would misread as "played some and lost every one". */
  winRate: number | null;
  roleBreakdown: Partial<Record<Team, number>>;
  /** Games where self_is_storyteller is true — has no personal win/loss
   * and isn't in `gamesWithResult`/`roleBreakdown` at all, so it gets its
   * own tile on the Account Overview instead of being silently dropped. */
  storytellerGames: number;
  /** Win rate scoped to games played on the Good side / the Evil side —
   * same null-when-no-data rule as `winRate` above, computed from
   * game_players' own alignment column (`team`), not the joined
   * character's team (that one feeds `roleBreakdown` instead). */
  goodWinRate: number | null;
  evilWinRate: number | null;
}

// --- Groups & Leaderboard ---------------------------------------------------
// Mirrors supabase/migrations/20260918*_groups_feature_schema.sql and the
// two migrations right after it (leaderboard/history functions,
// group-covers storage bucket) — keep in sync.

export type GroupVisibility = "private" | "public";

export const GROUP_VISIBILITY_LABELS: Record<GroupVisibility, string> = {
  private: "Private — requests need your approval",
  public: "Public — anyone can join instantly",
};

/** A group's full row, including its points-distribution config. Every
 * `*_mistake` column is the point value used instead of its plain
 * counterpart when the logged game had `storyteller_mistakes = true` (see
 * lib/game-actions.ts) — not a separate category of its own. */
export interface Group {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  /** The group's "ID#" shown to users, e.g. "D4423" — one letter + 4
   * digits (see generate_group_invite_code()). Also the free-text code
   * used to tag a logged game to this group (GameLogForm's "Group
   * code(s)" field) — the same column, two use cases. */
  invite_code: string;
  visibility: GroupVisibility;
  cover_image_url: string | null;
  /** "YYYY-MM-DD" or null. Both null = "no set date" (Diego's ask) — an
   * open-ended group. */
  playtime_start: string | null;
  playtime_end: string | null;
  count_wins: boolean;
  win_points: number;
  win_points_mistake: number;
  count_losses: boolean;
  loss_points: number;
  loss_points_mistake: number;
  /** On by default, same weight as a Win (3 points), -2 if a Storyteller
   * mistake was noted — Diego's spec. */
  count_storyteller: boolean;
  storyteller_points: number;
  storyteller_points_mistake: number;
  created_at: string;
}

/** A group card on /groups — the full row plus the two things only the
 * list view needs. */
export interface GroupCardRow extends Group {
  member_count: number;
  my_role: "owner" | "member";
}

/** A public group as shown on the /groups/join browse list — deliberately
 * not the full Group row (no points config, no playtime — that's for
 * members only once they're in). */
export interface PublicGroupRow {
  id: string;
  name: string;
  description: string | null;
  invite_code: string;
  cover_image_url: string | null;
  member_count: number;
}

export type GroupJoinRequestStatus = "pending" | "approved" | "rejected";

/** One pending request, as the group owner sees it on the group's Players
 * tab, with just enough of the requester's profile to show a name/avatar
 * next to Approve/Reject. */
export interface PendingJoinRequestRow {
  id: string;
  group_id: string;
  user_id: string;
  created_at: string;
  requester_display_name: string | null;
  requester_avatar_url: string | null;
  requester_avatar_character_icon_url: string | null;
}

/** One row of the leaderboard (get_group_leaderboard() RPC, joined in
 * lib/queries.ts with the corresponding profiles rows for display, plus
 * each avatar_character_id's icon_url so cards don't need the full
 * characters list just to render an avatar). A member with zero logged
 * games still appears, at 0 points. */
export interface GroupLeaderboardRow {
  user_id: string;
  points: number;
  wins: number;
  losses: number;
  storyteller_games: number;
  games_played: number;
  display_name: string | null;
  avatar_url: string | null;
  avatar_character_id: string | null;
  avatar_character_icon_url: string | null;
}

/** One (game, player) pair tagged to a group — the History tab's thin
 * per-player cards (get_group_game_history() RPC). `team`/`won` are null
 * for a free-text-only logged player (see GameLogForm's "Players" field —
 * it captures names only, not team/result, today). */
export interface GroupHistoryRow {
  game_id: string;
  played_at: string;
  script_name: string | null;
  self_is_storyteller: boolean;
  storyteller_user_id: string | null;
  storyteller_display_name: string | null;
  player_user_id: string | null;
  player_display_name: string | null;
  team: Alignment | null;
  won: boolean | null;
  character_name: string | null;
  character_icon_url: string | null;
  total_count: number;
}

export const GROUPS_PAGE_SIZE = 20;
export const GROUP_HISTORY_PAGE_SIZE = 30;

/** Formats a group's playtime window the way Diego's spec showed it
 * ("9/18/26-9/22/26") — M/D/YY, no leading zeros. Both null reads as
 * "No set date"; either alone reads as an open-ended start/end. */
export function formatGroupPlaytime(
  start: string | null,
  end: string | null,
): string {
  const fmt = (d: string) => {
    const [y, m, day] = d.split("-");
    return `${Number(m)}/${Number(day)}/${y.slice(2)}`;
  };
  if (!start && !end) return "No set date";
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  if (start) return `Starts ${fmt(start)}`;
  return `Ends ${fmt(end as string)}`;
}

/** The create-group form's points-distribution fields, camelCased for the
 * client — createGroupAction (lib/group-actions.ts) reads these back off
 * FormData with the matching snake_case names shown in each comment. */
export interface GroupPointsConfig {
  /** count_wins */
  countWins: boolean;
  /** win_points */
  winPoints: number;
  /** win_points_mistake */
  winPointsMistake: number;
  /** count_losses */
  countLosses: boolean;
  /** loss_points */
  lossPoints: number;
  /** loss_points_mistake */
  lossPointsMistake: number;
  /** count_storyteller */
  countStoryteller: boolean;
  /** storyteller_points */
  storytellerPoints: number;
  /** storyteller_points_mistake */
  storytellerPointsMistake: number;
}

/** Mirrors the groups table's own column defaults (see the migration) —
 * kept here too so the create-group form can render its initial values
 * without a round trip. */
export const DEFAULT_GROUP_POINTS_CONFIG: GroupPointsConfig = {
  countWins: true,
  winPoints: 3,
  winPointsMistake: 1,
  countLosses: true,
  lossPoints: -3,
  lossPointsMistake: -1,
  countStoryteller: true,
  storytellerPoints: 3,
  storytellerPointsMistake: -2,
}
