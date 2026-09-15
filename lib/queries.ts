import { createClient } from "@/lib/supabase/server";
import type {
  Character,
  Script,
  ScriptSearchRow,
  ScriptSortOrder,
  ScriptType,
  Team,
  Edition,
} from "@/lib/types";
import { SCRIPTS_PAGE_SIZE } from "@/lib/types";
import type { GlobalJinxRow } from "@/lib/jinxes";

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
  /** Defaults to "newest" (search_scripts()'s own default) when omitted. */
  sort?: ScriptSortOrder;
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
  sort,
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
    p_sort: sort || "newest",
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

/** Total like count for one script — `script_likes` is a plain join table
 * (script_id, user_id) with no running total column, so this is a real
 * COUNT query (`head: true` skips fetching any rows, just the count).
 * Cheap enough for a single script-detail-page load; a table listing many
 * scripts at once still gets its counts from search_scripts()'s own
 * aggregate instead of one query per row. */
export async function getScriptLikeCount(scriptId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("script_likes")
    .select("*", { count: "exact", head: true })
    .eq("script_id", scriptId);

  if (error) throw error;
  return count ?? 0;
}

/** Which of the given scripts the given user has liked — used to render
 * each LikeButton's initial filled/outline state (see app/scripts/
 * LikeButton.tsx) for a page's worth of scripts in one query instead of
 * one per row. Empty input short-circuits to an empty set without a
 * round trip. */
export async function getLikedScriptIds(
  userId: string,
  scriptIds: string[],
): Promise<Set<string>> {
  if (scriptIds.length === 0) return new Set();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("script_likes")
    .select("script_id")
    .eq("user_id", userId)
    .in("script_id", scriptIds);

  if (error) throw error;
  return new Set((data ?? []).map((row) => row.script_id as string));
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

/** The official jinx pairs (see
 * supabase/migrations/20260914000000_character_jinxes.sql) applicable to a
 * specific set of characters — i.e. both sides of the pair are among the
 * given ids. Pass a script's own character uuids (from
 * getCharactersForScript) to get exactly the jinxes relevant to that
 * script. Two separate `.in()` filters on the same table, rather than an
 * `.or()`, since PostgREST's `.or()` syntax doesn't cleanly express "both
 * columns must be in this set" — this reads as "rows where character_a_id
 * is in the set AND character_b_id is in the set", which is exactly that. */
export async function getJinxesForCharacterIds(
  characterIds: string[],
): Promise<GlobalJinxRow[]> {
  if (characterIds.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("character_jinxes")
    .select("character_a_id, character_b_id, reason")
    .in("character_a_id", characterIds)
    .in("character_b_id", characterIds);

  if (error) throw error;
  return (data ?? []).map((row) => ({
    characterAId: row.character_a_id as string,
    characterBId: row.character_b_id as string,
    reason: row.reason as string,
  }));
}

/** A single official character by its script-json id (e.g. "djinn") —
 * used to auto-include Djinn on scripts that have resolvable jinxes but
 * didn't literally list Djinn in their own uploaded data (see
 * withImpliedDjinn in lib/jinxes.ts for why). `maybeSingle` rather than
 * `single` since a lookup that finds nothing (id typo'd, or the
 * characters table not seeded yet in some environment) should return
 * null, not throw. */
export async function getCharacterByCharacterId(
  characterId: string,
): Promise<Character | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("characters")
    .select("*")
    .eq("character_id", characterId)
    .eq("is_homebrew", false)
    .maybeSingle();

  if (error) throw error;
  return data as Character | null;
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
