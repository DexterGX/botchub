-- Fixes a real bug Diego hit trying to log his first game in production:
-- "infinite recursion detected in policy for relation games". Root cause:
-- games' "group members can see games tagged with their group" SELECT
-- policy subqueries game_groups (RLS-protected); evaluating that subquery
-- applies game_groups' own SELECT policies, one of which ("the creator can
-- see their game's group tags") subqueries games again — which re-applies
-- games' own policies, including the one that started this — an infinite
-- cycle Postgres detects and aborts. logGameAction's `.insert(...).select(
-- "id").single()` triggers this because a RETURNING clause applies SELECT
-- policies to the inserted row, so it was hit on literally every game log
-- attempt, not just reads.
--
-- Fix: SECURITY DEFINER helper functions that read the *other* table
-- directly, bypassing its RLS (these functions are owned by the migration
-- role, which has BYPASSRLS) — so a policy can check "does this game
-- belong to a group I'm in" without ever re-triggering that group's own
-- policy evaluation. Applied to games/game_groups/game_players.
--
-- The same shape of bug exists, dormant, between groups and group_members
-- (groups' SELECT policy subqueries group_members, whose own SELECT policy
-- subqueries groups back) — nothing exercises that path today since Groups
-- has no creation UI yet, but it's the identical mistake and will bite the
-- moment Phase 9 ships, so it's fixed here too while this is fresh.

-- 1. Helper functions.
create or replace function public.is_game_creator(_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.games g
    where g.id = _game_id and g.created_by = (select auth.uid())
  );
$$;

create or replace function public.game_group_ids(_game_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select group_id from public.game_groups where game_id = _game_id;
$$;

create or replace function public.is_group_member_or_owner(_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members gm
    where gm.group_id = _group_id and gm.user_id = (select auth.uid())
  ) or exists (
    select 1 from public.groups g
    where g.id = _group_id and g.owner_id = (select auth.uid())
  );
$$;

create or replace function public.is_group_owner(_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.groups g
    where g.id = _group_id and g.owner_id = (select auth.uid())
  );
$$;

comment on function public.is_game_creator(uuid) is 'Bypasses games RLS (SECURITY DEFINER) so game_groups/game_players policies can check game ownership without re-triggering games'' own policy set — breaks the games<->game_groups RLS recursion.';
comment on function public.game_group_ids(uuid) is 'Bypasses game_groups RLS (SECURITY DEFINER) so games'' policy can check a game''s group tags without re-triggering game_groups'' own policy set.';
comment on function public.is_group_member_or_owner(uuid) is 'Bypasses group_members/groups RLS (SECURITY DEFINER) for membership checks used from games/game_groups policies.';
comment on function public.is_group_owner(uuid) is 'Bypasses groups RLS (SECURITY DEFINER) so group_members'' policy can check group ownership without re-triggering groups'' own policy set — breaks the latent groups<->group_members RLS recursion (not yet exercised, since Groups has no creation UI, but the same bug class).';

-- 2. games: route the group-based SELECT branch through the helpers.
drop policy "group members can see games tagged with their group" on public.games;
create policy "group members can see games tagged with their group"
  on public.games for select
  using (
    exists (
      select 1 from public.game_group_ids(games.id) gid
      where public.is_group_member_or_owner(gid)
    )
  );

-- 3. game_groups: route every policy through the helpers.
drop policy "the creator can see their game's group tags" on public.game_groups;
create policy "the creator can see their game's group tags"
  on public.game_groups for select
  using (public.is_game_creator(game_groups.game_id));

drop policy "group members can see a game tagged with their group" on public.game_groups;
create policy "group members can see a game tagged with their group"
  on public.game_groups for select
  using (public.is_group_member_or_owner(game_groups.group_id));

drop policy "the creator tags their own game with a group they belong to" on public.game_groups;
create policy "the creator tags their own game with a group they belong to"
  on public.game_groups for insert
  with check (
    public.is_game_creator(game_groups.game_id)
    and public.is_group_member_or_owner(game_groups.group_id)
  );

drop policy "the creator removes a group tag from their own game" on public.game_groups;
create policy "the creator removes a group tag from their own game"
  on public.game_groups for delete
  using (public.is_game_creator(game_groups.game_id));

-- 4. game_players: same treatment for its group-based SELECT branch and
-- its creator-only write policies (all previously inlined the same
-- recursion-prone "EXISTS (SELECT 1 FROM games ...)" shape).
drop policy "game_players follow the parent game's visibility" on public.game_players;
create policy "game_players follow the parent game's visibility"
  on public.game_players for select
  using (
    public.is_game_creator(game_players.game_id)
    or exists (
      select 1 from public.game_group_ids(game_players.game_id) gid
      where public.is_group_member_or_owner(gid)
    )
  );

drop policy "the game's creator manages its players" on public.game_players;
create policy "the game's creator manages its players"
  on public.game_players for insert
  with check (public.is_game_creator(game_players.game_id));

drop policy "the game's creator updates its players" on public.game_players;
create policy "the game's creator updates its players"
  on public.game_players for update
  using (public.is_game_creator(game_players.game_id));

drop policy "the game's creator deletes its players" on public.game_players;
create policy "the game's creator deletes its players"
  on public.game_players for delete
  using (public.is_game_creator(game_players.game_id));

-- 5. group_members: route its owner-check branch through is_group_owner()
-- so groups' own SELECT policy (which subqueries group_members directly —
-- left as-is, since it no longer feeds back into groups) can't loop.
drop policy "members can see the membership list of their own groups" on public.group_members;
create policy "members can see the membership list of their own groups"
  on public.group_members for select
  using (
    user_id = (select auth.uid())
    or public.is_group_owner(group_members.group_id)
  );

drop policy "members can leave, owners can remove members" on public.group_members;
create policy "members can leave, owners can remove members"
  on public.group_members for delete
  using (
    user_id = (select auth.uid())
    or public.is_group_owner(group_members.group_id)
  );
