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

export interface Script {
  id: string;
  owner_id: string | null;
  name: string;
  description: string | null;
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
  entry: ScriptJsonEntry
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
  return edition ? EDITION_LABELS[edition] ?? edition : "Custom";
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
