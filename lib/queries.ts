import { createClient } from "@/lib/supabase/server";
import type {
  Character,
  Script,
  ScriptSearchRow,
  ScriptType,
  Team,
  Edition,
} from "@/lib/types";
import { SCRIPTS_PAGE_SIZE } from "@/lib/types";

export async function getRecentScripts(limit = 6): Promise<Script[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scripts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as Script[];
}

export interface ScriptSearchParams {
  q?: string;
  type?: ScriptType;
  author?: string;
  /** characters.character_id values (script-json ids, e.g. "imp") the
   * script must include ALL of. */
  includeCharacterIds?: string[];
  /** characters.character_id values the script must include NONE of. */
  excludeCharacterIds?: string[];
  /** 1-indexed page number. */
  page?: number;
}

export interface ScriptSearchResult {
  scripts: ScriptSearchRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Combined name/type/author/character-include/character-exclude search
 * with pagination, backed by the search_scripts() SQL function — a plain
 * PostgREST filter chain can't express "contains ALL of these characters"
 * or "contains NONE of these characters" cleanly, so that logic lives in
 * the database instead. */
export async function searchScripts({
  q,
  type,
  author,
  includeCharacterIds,
  excludeCharacterIds,
  page = 1,
}: ScriptSearchParams): Promise<ScriptSearchResult> {
  const supabase = await createClient();
  const pageSize = SCRIPTS_PAGE_SIZE;
  const safePage = Math.max(1, page);

  const { data, error } = await supabase.rpc("search_scripts", {
    p_query: q || null,
    p_type: type || null,
    p_author: author || null,
    p_include_character_ids:
      includeCharacterIds && includeCharacterIds.length > 0
        ? includeCharacterIds
        : null,
    p_exclude_character_ids:
      excludeCharacterIds && excludeCharacterIds.length > 0
        ? excludeCharacterIds
        : null,
    p_limit: pageSize,
    p_offset: (safePage - 1) * pageSize,
  });

  if (error) throw error;

  const rows = (data ?? []) as ScriptSearchRow[];
  const totalCount = rows[0]?.total_count ?? 0;

  return {
    scripts: rows,
    totalCount,
    page: safePage,
    pageSize,
    totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
  };
}

export async function getScriptById(id: string): Promise<Script | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scripts")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data as Script | null;
}

/** Fire-and-forget view count bump. Never blocks or throws into the page. */
export async function incrementScriptViewCount(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("increment_script_view_count", { script_id: id });
}

export async function getCharactersForScript(
  scriptId: string,
): Promise<Character[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("script_characters")
    .select("character:characters(*)")
    .eq("script_id", scriptId)
    // Preserves the script's own author-intended character order (see
    // supabase/migrations/20260913010000_script_character_position.sql) —
    // a plain join with no `order by` has no guaranteed row order in
    // Postgres/PostgREST, which is exactly what let the PDF and the
    // script page disagree on ordering despite reading identical data.
    .order("position", { ascending: true });

  if (error) throw error;
  // Same untyped-embed caveat as searchScripts above: this is a
  // many-to-one relation, not an array, despite how it's inferred.
  const rows = (data ?? []) as unknown as { character: Character | null }[];
  return rows
    .map((row) => row.character)
    .filter((c): c is Character => Boolean(c));
}

/** Official characters only, grouped for a filter dropdown — cheap enough to
 * fetch in full since there are only ~130 of them. Ordered by team then
 * name only (not edition first) so each team group reads as one clean
 * alphabetized list regardless of which edition a character came from —
 * most of the library (Travellers and the wider "extras" pool) doesn't
 * belong to a single edition anyway. */
export async function getOfficialCharactersForFilter(): Promise<Character[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("characters")
    .select("*")
    .eq("is_homebrew", false)
    .order("team", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Character[];
}

export interface CharacterSearchParams {
  q?: string;
  team?: Team;
  edition?: Edition | "homebrew";
}

export async function searchCharacters({
  q,
  team,
  edition,
}: CharacterSearchParams): Promise<Character[]> {
  const supabase = await createClient();
  let query = supabase.from("characters").select("*");

  if (q) {
    query = query.or(`name.ilike.%${q}%,ability.ilike.%${q}%`);
  }
  if (team) {
    query = query.eq("team", team);
  }
  if (edition === "homebrew") {
    query = query.eq("is_homebrew", true);
  } else if (edition) {
    query = query.eq("edition", edition);
  }

  const { data, error } = await query.order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Character[];
}
