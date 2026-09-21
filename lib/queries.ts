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
  Group,
  GroupCardRow,
  PublicGroupRow,
  PendingJoinRequestRow,
  GroupLeaderboardRow,
  GroupHistoryRow,
  GroupVisibility,
} from "@/lib/types";
import {
  GAMES_PAGE_SIZE,
  SCRIPTS_PAGE_SIZE,
  GROUP_HISTORY_PAGE_SIZE,
} from "@/lib/types";
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
  /** Only scripts with `difficulty >= minDifficulty` (see
   * lib/types.ts's DIFFICULTY_FILTER_OPTIONS). Omitted/undefined means no
   * floor — search_scripts()'s own p_min_difficulty default. */
  minDifficulty?: number;
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
  minDifficulty,
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
    p_min_difficulty: minDifficulty ?? null,
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

export interface LikedScriptRow {
  id: string;
  name: string;
  version: string;
  description: string | null;
  author: string | null;
  script_type: ScriptType;
  difficulty: number | null;
  like_count: number;
  liked_at: string;
}

/** The signed-in user's own liked (❤️) scripts, newest-liked first — the
 * Account page's new Favorites tab. One query for the scripts themselves
 * (via the script_likes join, RLS-scoped to the caller's own rows since
 * there's no explicit .eq("user_id", userId) needed beyond what the
 * policy already restricts — matches getMyGroupCodes' reasoning) plus one
 * more for their like counts (same batched-count pattern as
 * countMembersByGroup, rather than one count query per script). */
export async function getMyLikedScripts(userId: string): Promise<LikedScriptRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("script_likes")
    .select(
      "created_at, script:scripts(id, name, version, description, author, script_type, difficulty)",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  // Same untyped-embed caveat noted throughout this file.
  const rows = (data ?? []) as unknown as {
    created_at: string;
    script: {
      id: string;
      name: string;
      version: string;
      description: string | null;
      author: string | null;
      script_type: ScriptType;
      difficulty: number | null;
    } | null;
  }[];
  const liked = rows.filter(
    (r): r is typeof r & { script: NonNullable<typeof r.script> } =>
      r.script !== null,
  );
  if (liked.length === 0) return [];

  const { data: likeCounts, error: countError } = await supabase
    .from("script_likes")
    .select("script_id")
    .in(
      "script_id",
      liked.map((r) => r.script.id),
    );
  if (countError) throw countError;
  const countByScriptId = new Map<string, number>();
  for (const row of likeCounts ?? []) {
    const id = row.script_id as string;
    countByScriptId.set(id, (countByScriptId.get(id) ?? 0) + 1);
  }

  return liked.map((r) => ({
    ...r.script,
    like_count: countByScriptId.get(r.script.id) ?? 0,
    liked_at: r.created_at,
  }));
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

/** Name + invite code for every group the signed-in user belongs to
 * (member or owner) — powers the Group code(s) autocomplete on the log
 * forms, shown as "Name - ID#" so the code alone doesn't have to be
 * memorable. Takes no userId: unlike getMyGames (which needs it to also
 * pick the caller's own row out of a joined game_players list), scoping
 * here comes entirely from groups' own SELECT RLS policy (owner or member
 * can see a group), so this plain unfiltered select is already scoped
 * without duplicating that check here — the caller must still be signed
 * in for RLS to apply. */
export async function getMyGroupCodes(): Promise<
  { code: string; name: string }[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("groups")
    .select("invite_code, name, playtime_end");

  if (error) throw error;

  // A group whose playtime has ended is done taking new games (see
  // logGameAction's own server-side enforcement of the same rule) — no
  // point suggesting a code that would just be rejected on submit. Plain
  // string comparison, same reasoning as logGameAction's todayStr check.
  const todayStr = new Date().toISOString().slice(0, 10);
  return (data ?? [])
    .filter((row) => {
      const playtimeEnd = row.playtime_end as string | null;
      return !playtimeEnd || playtimeEnd >= todayStr;
    })
    .map((row) => ({
      code: row.invite_code as string,
      name: row.name as string,
    }));
}

// --- Groups & Leaderboard ---------------------------------------------------

/** Adds each group's member_count in one extra query rather than one per
 * group — cheap at today's scale, and avoids an N+1 as soon as a user is
 * in more than a couple of groups. Only counts 'active' memberships — a
 * member who's left is still a group_members row (see the leave-and-freeze
 * migration) but shouldn't inflate the headline "N members" anywhere. */
async function countMembersByGroup(
  groupIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (groupIds.length === 0) return counts;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("group_members")
    .select("group_id")
    .in("group_id", groupIds)
    .eq("status", "active");
  if (error) throw error;

  for (const row of data ?? []) {
    const id = row.group_id as string;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

/** Every group the signed-in user owns or belongs to, for the /groups
 * cards list — including a group they've since left, whose card stays put
 * (grayed out, frozen points) rather than disappearing; see
 * GroupCard/GroupCardMenu and leave_group(). Two lookups (owned groups,
 * membership rows) rather than one `.or()` across tables — Supabase's
 * query builder can't express "owner_id = me OR id in (my group_members'
 * group_ids)" as a single filter without string-interpolating ids into
 * `.or()`, and this keeps the id list a real array instead. */
export async function getMyGroups(userId: string): Promise<GroupCardRow[]> {
  const supabase = await createClient();

  const { data: memberRows, error: memberError } = await supabase
    .from("group_members")
    .select("group_id, role, status, frozen_points, hidden_from_own_list")
    .eq("user_id", userId);
  if (memberError) throw memberError;

  // A left membership the user dismissed from this list (see
  // hide_left_group_membership()) is skipped here only — the underlying
  // group_members row is untouched, so it still shows up, "Quit" tag and
  // all, on get_group_leaderboard() for everyone still in the group.
  const visibleMemberRows = (memberRows ?? []).filter(
    (r) => !(r.status === "left" && r.hidden_from_own_list),
  );

  const membershipByGroupId = new Map(
    visibleMemberRows.map((r) => [
      r.group_id as string,
      {
        role: r.role as "owner" | "member",
        status: r.status as "active" | "left",
        frozenPoints: r.frozen_points as number | null,
      },
    ]),
  );
  const groupIds = Array.from(membershipByGroupId.keys());

  const { data, error } = await supabase
    .from("groups")
    .select("*")
    .or(
      groupIds.length > 0
        ? `owner_id.eq.${userId},id.in.(${groupIds.join(",")})`
        : `owner_id.eq.${userId}`,
    )
    .order("created_at", { ascending: false });
  if (error) throw error;

  const groups = (data ?? []) as Group[];
  const counts = await countMembersByGroup(groups.map((g) => g.id));

  const rows = groups.map((g) => {
    const membership = membershipByGroupId.get(g.id);
    return {
      ...g,
      member_count: counts.get(g.id) ?? 0,
      my_role: g.owner_id === userId ? "owner" : (membership?.role ?? "member"),
      // An owner's own group_members row is always 'active' (they can't
      // leave — see leave_group()), so defaulting to "active" here covers
      // both "no row found" and the ordinary owner case identically.
      membership_status: membership?.status ?? "active",
      frozen_points: membership?.frozenPoints ?? null,
    };
  });

  // Diego's ask: grayed-out (left) groups belong after the currently
  // active ones, not wherever their created_at happened to sort them.
  // Array.prototype.sort is stable (guaranteed since ES2019 / every
  // current JS engine), so this only ever moves 'left' rows down — the
  // recency order the query above already produced within each bucket is
  // untouched.
  return rows.sort(
    (a, b) =>
      (a.membership_status === "left" ? 1 : 0) -
      (b.membership_status === "left" ? 1 : 0),
  );
}

export interface PublicGroupSearchParams {
  q?: string;
}

/** The /groups/join browse list — every group with visibility='public',
 * which its own RLS policy already allows anyone to SELECT (see the
 * schema migration's "public groups are visible to everyone" policy). */
export async function getPublicGroups({
  q,
}: PublicGroupSearchParams): Promise<PublicGroupRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("groups")
    .select("id, name, description, invite_code, cover_image_url")
    .eq("visibility", "public");

  if (q) {
    query = query.ilike("name", `%${q}%`);
  }

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;

  const groups = (data ?? []) as Omit<PublicGroupRow, "member_count">[];
  const counts = await countMembersByGroup(groups.map((g) => g.id));
  return groups.map((g) => ({ ...g, member_count: counts.get(g.id) ?? 0 }));
}

/** Resolves a typed ID# to a group via the find_group_by_code() RPC — the
 * one path that can reach a private, not-yet-joined group by its exact
 * code without a broader RLS policy exposing it to any browse/list
 * query (see the schema migration's reasoning). Returns null for an
 * unknown code rather than throwing, since "no such code" is an expected
 * user-typo case here, not an error. */
export async function findGroupByCode(
  code: string,
): Promise<PublicGroupRow & { visibility: GroupVisibility; description: string | null } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("find_group_by_code", {
    p_code: code.trim().toUpperCase(),
  });
  if (error) throw error;

  const row = (data ?? [])[0] as
    | {
        id: string;
        name: string;
        description: string | null;
        visibility: GroupVisibility;
        invite_code: string;
        cover_image_url: string | null;
        member_count: number;
      }
    | undefined;
  return row ?? null;
}

/** A plain RLS-scoped select is invisible for a PRIVATE group the caller
 * isn't a member of yet (see find_group_by_id()'s migration comment) —
 * which would 404 /groups/[id] for anyone who found a private group via
 * search but hasn't been approved to join it. Falls back to the
 * SECURITY DEFINER find_group_by_id() RPC (exact-id-only, same "you must
 * already know the identifier" model as find_group_by_code()) only when
 * the fast RLS-scoped path comes back empty. */
export async function getGroupById(id: string): Promise<Group | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("groups")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (data) return data as Group;

  const { data: rpcRows, error: rpcError } = await supabase.rpc(
    "find_group_by_id",
    { p_group_id: id },
  );
  if (rpcError) throw rpcError;
  return ((rpcRows ?? [])[0] as Group | undefined) ?? null;
}

/** null = not a member (and not the owner — callers already have the
 * group's own owner_id to check that side separately). */
export async function getGroupMembership(
  groupId: string,
  userId: string,
): Promise<"owner" | "member" | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data?.role as "owner" | "member" | undefined) ?? null;
}

export async function getMyJoinRequestStatus(
  groupId: string,
  userId: string,
): Promise<"pending" | "approved" | "rejected" | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("group_join_requests")
    .select("status")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data?.status as "pending" | "approved" | "rejected" | undefined) ?? null;
}

/** Pending requests for the group owner's own Players-tab approval queue
 * — RLS already limits group_join_requests SELECT to the requester
 * themselves or the group's owner, so a non-owner calling this simply
 * gets an empty list back, not an error. */
export async function getPendingJoinRequests(
  groupId: string,
): Promise<PendingJoinRequestRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("group_join_requests")
    .select(
      "id, group_id, user_id, created_at, profile:profiles(display_name, avatar_url, avatar_character_id)",
    )
    .eq("group_id", groupId)
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) throw error;

  // Same untyped-embed caveat noted throughout this file.
  const rows = (data ?? []) as unknown as {
    id: string;
    group_id: string;
    user_id: string;
    created_at: string;
    profile: {
      display_name: string | null;
      avatar_url: string | null;
      avatar_character_id: string | null;
    } | null;
  }[];

  const iconByCharacterId = await getCharacterIconsByIds(
    rows.map((r) => r.profile?.avatar_character_id ?? null),
  );

  return rows.map((row) => ({
    id: row.id,
    group_id: row.group_id,
    user_id: row.user_id,
    created_at: row.created_at,
    requester_display_name: row.profile?.display_name ?? null,
    requester_avatar_url: row.profile?.avatar_url ?? null,
    requester_avatar_character_icon_url: row.profile?.avatar_character_id
      ? (iconByCharacterId.get(row.profile.avatar_character_id) ?? null)
      : null,
  }));
}

/** Shared by getPendingJoinRequests and getGroupLeaderboard — both need to
 * turn a batch of profiles' avatar_character_id into icon_url without
 * pulling down the whole ~155-row characters table on every call. */
async function getCharacterIconsByIds(
  characterIds: (string | null)[],
): Promise<Map<string, string | null>> {
  const ids = Array.from(new Set(characterIds.filter((id): id is string => !!id)));
  const icons = new Map<string, string | null>();
  if (ids.length === 0) return icons;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("characters")
    .select("character_id, icon_url")
    .in("character_id", ids);
  if (error) throw error;

  for (const row of data ?? []) {
    icons.set(row.character_id as string, row.icon_url as string | null);
  }
  return icons;
}

/** The group's leaderboard — scores from the get_group_leaderboard() RPC
 * (see the migration), then joined here with each scored user's profile
 * for display, since the RPC itself only returns user_id (it doesn't know
 * about the profiles table's display columns and shouldn't need to). */
export async function getGroupLeaderboard(
  groupId: string,
): Promise<GroupLeaderboardRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_group_leaderboard", {
    p_group_id: groupId,
  });
  if (error) throw error;

  const rows = (data ?? []) as {
    user_id: string;
    points: number;
    wins: number;
    losses: number;
    storyteller_games: number;
    games_played: number;
    status: "active" | "left";
  }[];
  if (rows.length === 0) return [];

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, avatar_character_id")
    .in("id", rows.map((r) => r.user_id));
  if (profilesError) throw profilesError;

  const profileById = new Map(
    (profiles ?? []).map((p) => [
      p.id as string,
      p as { display_name: string | null; avatar_url: string | null; avatar_character_id: string | null },
    ]),
  );
  const iconByCharacterId = await getCharacterIconsByIds(
    (profiles ?? []).map((p) => p.avatar_character_id as string | null),
  );

  return rows
    .map((r) => {
      const profile = profileById.get(r.user_id);
      const avatarCharacterId = profile?.avatar_character_id ?? null;
      return {
        ...r,
        display_name: profile?.display_name ?? null,
        avatar_url: profile?.avatar_url ?? null,
        avatar_character_id: avatarCharacterId,
        avatar_character_icon_url: avatarCharacterId
          ? (iconByCharacterId.get(avatarCharacterId) ?? null)
          : null,
      };
    })
    .sort((a, b) => b.points - a.points || b.wins - a.wins);
}

export interface GroupHistoryPage {
  rows: GroupHistoryRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** The group detail page's History tab — one row per (game, player), via
 * the get_group_game_history() RPC (see the migration). */
export async function getGroupHistoryPage(
  groupId: string,
  page = 1,
): Promise<GroupHistoryPage> {
  const supabase = await createClient();
  const pageSize = GROUP_HISTORY_PAGE_SIZE;
  const safePage = Math.max(1, page);

  const { data, error } = await supabase.rpc("get_group_game_history", {
    p_group_id: groupId,
    p_limit: pageSize,
    p_offset: (safePage - 1) * pageSize,
  });
  if (error) throw error;

  const rows = (data ?? []) as GroupHistoryRow[];
  const totalCount = rows[0]?.total_count ?? 0;

  return {
    rows,
    totalCount,
    page: safePage,
    pageSize,
    totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
  };
}
