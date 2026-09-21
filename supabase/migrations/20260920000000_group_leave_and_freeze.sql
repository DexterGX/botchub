-- "Leave a group" (Diego's ask, /groups card menu): a member who leaves
-- shouldn't just vanish from their own "Your groups" list — the card
-- stays there, grayed out, with their points frozen at whatever they'd
-- earned. That means LEAVING can't be the existing "delete the
-- group_members row" behavior (that's now a separate, later "remove from
-- my groups" action instead) — it has to keep the row around as a
-- historical record while taking the member out of the group's *live*
-- leaderboard.

-- 1. group_members: a status instead of an implicit "row exists = member",
-- plus a frozen snapshot of the leaving member's own stats. Nullable —
-- only ever set at the moment of leaving.
alter table public.group_members
  add column status text not null default 'active' check (status in ('active', 'left')),
  add column left_at timestamptz,
  add column frozen_points integer,
  add column frozen_wins integer,
  add column frozen_losses integer,
  add column frozen_storyteller_games integer,
  add column frozen_games_played integer;

-- 2. get_group_leaderboard: a left member's points stop moving because
-- they drop out of member_ids entirely (their historical games are still
-- in game_players/game_groups, but player_agg/st_agg no longer get
-- LEFT JOINed onto a member_ids row for them) — the group's live Players
-- tab/podium only ever shows current, active members. Their own frozen
-- snapshot (read separately, from GroupCard) is what represents them
-- everywhere else. Owner is unioned in unconditionally, same as before —
-- an owner can never be 'left' (leave_group() below blocks it).
create or replace function public.get_group_leaderboard(p_group_id uuid)
returns table (
  user_id uuid,
  points bigint,
  wins bigint,
  losses bigint,
  storyteller_games bigint,
  games_played bigint
)
language sql
stable
set search_path = ''
as $$
  with g as (
    select * from public.groups where id = p_group_id
  ),
  member_ids as (
    select gm.user_id from public.group_members gm
      where gm.group_id = p_group_id and gm.status = 'active'
    union
    select gr.owner_id from public.groups gr where gr.id = p_group_id
  ),
  player_agg as (
    select
      gp.user_id,
      sum(
        case
          when gp.won and (select count_wins from g) then
            case when ga.storyteller_mistakes then (select win_points_mistake from g) else (select win_points from g) end
          when gp.won = false and (select count_losses from g) then
            case when ga.storyteller_mistakes then (select loss_points_mistake from g) else (select loss_points from g) end
          else 0
        end
      ) as points,
      count(*) filter (where gp.won = true) as wins,
      count(*) filter (where gp.won = false) as losses,
      count(*) as games_played
    from public.game_groups gg
    join public.games ga on ga.id = gg.game_id
    join public.game_players gp on gp.game_id = ga.id
    where gg.group_id = p_group_id and gp.user_id is not null
    group by gp.user_id
  ),
  st_agg as (
    select
      ga.created_by as user_id,
      sum(
        case when (select count_storyteller from g) then
          case when ga.storyteller_mistakes then (select storyteller_points_mistake from g) else (select storyteller_points from g) end
        else 0 end
      ) as points,
      count(*) as storyteller_games
    from public.game_groups gg
    join public.games ga on ga.id = gg.game_id
    where gg.group_id = p_group_id and ga.self_is_storyteller and ga.created_by is not null
    group by ga.created_by
  )
  select
    m.user_id,
    coalesce(pa.points, 0) + coalesce(sa.points, 0) as points,
    coalesce(pa.wins, 0) as wins,
    coalesce(pa.losses, 0) as losses,
    coalesce(sa.storyteller_games, 0) as storyteller_games,
    coalesce(pa.games_played, 0) + coalesce(sa.storyteller_games, 0) as games_played
  from member_ids m
  left join player_agg pa on pa.user_id = m.user_id
  left join st_agg sa on sa.user_id = m.user_id
  order by points desc, wins desc;
$$;

-- 3. find_group_by_code: the "N members" count shown to someone browsing
-- to join shouldn't count people who've since left.
create or replace function public.find_group_by_code(p_code text)
returns table (
  id uuid,
  name text,
  description text,
  visibility text,
  invite_code text,
  cover_image_url text,
  member_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    g.id, g.name, g.description, g.visibility, g.invite_code, g.cover_image_url,
    (select count(*) from public.group_members gm where gm.group_id = g.id and gm.status = 'active') as member_count
  from public.groups g
  where g.invite_code = upper(trim(p_code));
$$;

-- 4. leave_group: freezes the caller's own stats and flips their row to
-- 'left', rather than deleting it (deleting stays reserved for the
-- separate, later "remove from my groups" action — a plain client-side
-- DELETE already covered by the existing "members can leave, owners can
-- remove members" policy, unaffected by any of this). Needs a SECURITY
-- DEFINER function for the same reason transfer_group_ownership() does:
-- group_members has no UPDATE policy at all, so a plain client-side update
-- would be rejected outright.
--
-- Reads the caller's live stats from get_group_leaderboard() itself
-- (BEFORE flipping their status) rather than re-deriving the points
-- formula here a second time — one source of truth for "how points are
-- computed", and it's naturally still counting this member as active at
-- the moment this function reads it.
create or replace function public.leave_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid;
  v_is_active_member boolean;
  v_stats record;
begin
  select owner_id into v_owner_id from public.groups where id = p_group_id;
  if v_owner_id is null then
    raise exception 'Group not found.';
  end if;
  if v_owner_id is not distinct from (select auth.uid()) then
    raise exception 'The owner can''t leave — transfer ownership or end the group instead.';
  end if;

  select exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = (select auth.uid()) and status = 'active'
  ) into v_is_active_member;
  if not v_is_active_member then
    raise exception 'You are not an active member of this group.';
  end if;

  select points, wins, losses, storyteller_games, games_played
    into v_stats
    from public.get_group_leaderboard(p_group_id)
    where user_id = (select auth.uid());

  update public.group_members
    set status = 'left',
        left_at = now(),
        frozen_points = coalesce(v_stats.points, 0),
        frozen_wins = coalesce(v_stats.wins, 0),
        frozen_losses = coalesce(v_stats.losses, 0),
        frozen_storyteller_games = coalesce(v_stats.storyteller_games, 0),
        frozen_games_played = coalesce(v_stats.games_played, 0)
    where group_id = p_group_id and user_id = (select auth.uid());
end;
$$;

-- Same anon/PUBLIC lockdown as transfer_group_ownership() — this project's
-- default privileges grant EXECUTE on every new function to PUBLIC *and*
-- separately, directly, to anon, so both need an explicit revoke.
revoke execute on function public.leave_group(uuid) from public;
revoke execute on function public.leave_group(uuid) from anon;
grant execute on function public.leave_group(uuid) to authenticated;
