import { createClient } from "@/lib/supabase/server";
import type {
  Alignment,
  Character,
  Script,
  ScriptSearchRow,
  ScriptSortOrder,
  ScriptType,
  Team,
  Edition,
  ScriptPickerRow,
  GameHistoryRow,
  GameStats,
} from "@/lib/types";
import { GAMES_PAGE_SIZE, SCRIPTS_PAGE_SIZE } from "@/lib/types";
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

// --- Track your games (Phase 7) -------------------------------------------

/** Every script, name/author/edition/type only — the "Script played" picker
 * filters this list client-side rather than hitting search_scripts() per
 * keystroke. Cheap at today's ~30 scripts; worth revisiting (a real search
 * endpoint, like the character picker's own future) once the library is
 * large enough that shipping the whole list stops being free — the same
 * scale warning the architecture doc already flags for stats aggregates. */
export async function getScriptsForPicker(): Promise<ScriptPickerRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scripts")
    .select("id, name, author, edition, script_type")
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ScriptPickerRow[];
}

export interface MyGamesPage {
  games: GameHistoryRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** The signed-in user's own logged games, paginated, for /games/history
 * and the Account Overview "recent games" widget (same query, just a
 * smaller `pageSize`). One query with everything a history card needs:
 * the script's name, the logger's own character/alignment/result (their
 * row in game_players, not any of the other free-text players a Detailed
 * Log might also carry), and which group codes (if any) this entry is
 * tagged with. Ordered by `created_at` (when the log was actually
 * submitted), not `played_at` (the date the user picked for the game
 * itself) — Diego's ask was "latest games added first," and a game
 * logged today for a game played last week should still show up at the
 * top, not wherever its played-at date would otherwise sort it. */
export async function getMyGamesPage(
  userId: string,
  page = 1,
  pageSize = GAMES_PAGE_SIZE,
): Promise<MyGamesPage> {
  const supabase = await createClient();
  const safePage = Math.max(1, page);
  const from = (safePage - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from("games")
    .select(
      `*,
      script:scripts(name),
      game_players(user_id, team, won, character:characters(name, icon_url)),
      game_groups(group:groups(invite_code))`,
      { count: "exact" },
    )
    .eq("created_by", userId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw error;

  // Same untyped-embed caveat noted throughout this file: supabase-js can't
  // tell `script` is many-to-one (vs. the true one-to-many game_players/
  // game_groups) from an untyped client, so this is cast rather than
  // trusted from inference.
  const rows = (data ?? []) as unknown as {
    [key: string]: unknown;
    id: string;
    external_script_name: string | null;
    script: { name: string } | null;
    game_players: {
      user_id: string | null;
      team: "good" | "evil" | null;
      won: boolean | null;
      character: { name: string; icon_url: string | null } | null;
    }[];
    game_groups: { group: { invite_code: string } | null }[];
  }[];

  const games = rows.map((row) => {
    const selfPlayer = row.game_players.find((p) => p.user_id === userId);
    return {
      ...(row as unknown as GameHistoryRow),
      script_name: row.script?.name ?? row.external_script_name ?? null,
      self_character_name: selfPlayer?.character?.name ?? null,
      self_character_icon_url: selfPlayer?.character?.icon_url ?? null,
      self_team: selfPlayer?.team ?? null,
      self_won: selfPlayer?.won ?? null,
      group_codes: row.game_groups
        .map((gg) => gg.group?.invite_code)
        .filter((code): code is string => Boolean(code)),
    };
  });

  const totalCount = count ?? 0;
  return {
    games,
    totalCount,
    page: safePage,
    pageSize,
    totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
  };
}

/** Account Overview's "Games played" / "Win rate" / "Storyteller games" /
 * Good-vs-Evil win rate / role-breakdown numbers. `game_players` rows
 * where `user_id` is the signed-in user are exactly the games where they
 * played an assigned character (never the rows Detailed Log creates for
 * other, free-text players) — and thanks to that table's own RLS (visible
 * only for a game you created, or one a shared group exposes), a plain
 * `.eq("user_id", userId)` here already only ever returns the caller's
 * own games, no extra `created_by` filter needed. `won` is a plain
 * boolean on that same row (set at log time — see lib/game-actions.ts),
 * and `team` there is the row's own Good/Evil alignment (distinct from
 * the joined character's `team`, which is Townsfolk/Outsider/etc. and
 * only ever feeds `roleBreakdown`) — so this one query yields the overall
 * win rate, the Good/Evil split, and the role breakdown together, no
 * extra round trips. Storyteller games have no game_players row for the
 * storyteller themselves (no personal win/loss to record), so that count
 * comes from a separate `games` query instead. */
export async function getMyGameStats(userId: string): Promise<GameStats> {
  const supabase = await createClient();

  const [
    { count: gamesPlayed, error: gamesError },
    { count: storytellerGames, error: storytellerError },
    { data: playerRows, error: playersError },
  ] = await Promise.all([
    supabase
      .from("games")
      .select("*", { count: "exact", head: true })
      .eq("created_by", userId),
    supabase
      .from("games")
      .select("*", { count: "exact", head: true })
      .eq("created_by", userId)
      .eq("self_is_storyteller", true),
    supabase
      .from("game_players")
      .select("won, team, character:characters(team)")
      .eq("user_id", userId),
  ]);

  if (gamesError) throw gamesError;
  if (storytellerError) throw storytellerError;
  if (playersError) throw playersError;

  const rows = (playerRows ?? []) as unknown as {
    won: boolean | null;
    team: Alignment | null;
    character: { team: Team } | null;
  }[];

  const roleBreakdown: Partial<Record<Team, number>> = {};
  let wins = 0;
  let goodGames = 0;
  let goodWins = 0;
  let evilGames = 0;
  let evilWins = 0;
  for (const row of rows) {
    if (row.won) wins += 1;
    const team = row.character?.team;
    if (team) roleBreakdown[team] = (roleBreakdown[team] ?? 0) + 1;

    if (row.team === "good") {
      goodGames += 1;
      if (row.won) goodWins += 1;
    } else if (row.team === "evil") {
      evilGames += 1;
      if (row.won) evilWins += 1;
    }
  }

  const gamesWithResult = rows.length;
  return {
    gamesPlayed: gamesPlayed ?? 0,
    gamesWithResult,
    wins,
    winRate: gamesWithResult > 0 ? wins / gamesWithResult : null,
    roleBreakdown,
    storytellerGames: storytellerGames ?? 0,
    goodWinRate: goodGames > 0 ? goodWins / goodGames : null,
    evilWinRate: evilGames > 0 ? evilWins / evilGames : null,
  };
}

/** Number of scripts the signed-in user has uploaded — the Account
 * Overview "Scripts" tile. `head: true` skips fetching any rows, just
 * the count, same pattern as getScriptLikeCount(). */
export async function getMyScriptCount(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("scripts")
    .select("*", { count: "exact", head: true })
    .eq("owner_id", userId);

  if (error) throw error;
  return count ?? 0;
}

/** Invite codes for every group the signed-in user belongs to (member or
 * owner) — powers the Group code(s) autocomplete on the log forms. Takes
 * no userId: unlike getMyGames (which needs it to also pick the caller's
 * own row out of a joined game_players list), scoping here comes entirely
 * from groups' own SELECT RLS policy (owner or member can see a group), so
 * this plain unfiltered select is already scoped without duplicating that
 * check here — the caller must still be signed in for RLS to apply. */
export async function getMyGroupCodes(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("groups").select("invite_code");

  if (error) throw error;
  return (data ?? []).map((row) => row.invite_code as string);
}
