-- Diego's ask (partial reversal of the leave-and-freeze migration): a
-- member who left shouldn't vanish from the *group's own* Players tab
-- either — "I dont want the user to disappear from the list, but instead
-- be grayed out... you can still give him a placement to see that even if
-- users left, they might still have been on top of others." The /groups
-- card behavior from that earlier migration (grayed card, frozen score,
-- excluded from the group's live member_count) is unaffected — this is
-- specifically about get_group_leaderboard()'s own result set, which the
-- group detail page's Players tab and Podium both render from.
--
-- A left member's row now carries their frozen snapshot instead of a
-- live-recomputed one (their games stop accruing the moment they leave —
-- same source of truth leave_group() already wrote), tagged with a new
-- `status` column so the UI can render them grayed with a "Quit" label
-- instead of a normal row.
--
-- `create or replace` can't add a new output column to an existing
-- function's row type (42P13 — "Row type defined by OUT parameters is
-- different"), same as the earlier character_icon_url addition to
-- get_group_game_history() — has to be dropped first.
drop function if exists public.get_group_leaderboard(uuid);

create function public.get_group_leaderboard(p_group_id uuid)
returns table (
  user_id uuid,
  points bigint,
  wins bigint,
  losses bigint,
  storyteller_games bigint,
  games_played bigint,
  status text
)
language sql
stable
set search_path = ''
as $$
  with g as (
    select * from public.groups where id = p_group_id
  ),
  -- Every group_members row for this group, active or left, plus a
  -- defensive union of the owner in case no row exists for them yet (same
  -- belt-and-suspenders as the pre-leave-and-freeze version of this
  -- function) — deduped via `union` so a normal owner (who always has
  -- their own 'active' row) doesn't get counted twice.
  member_rows as (
    select
      gm.user_id,
      gm.status,
      gm.frozen_points,
      gm.frozen_wins,
      gm.frozen_losses,
      gm.frozen_storyteller_games,
      gm.frozen_games_played
    from public.group_members gm
    where gm.group_id = p_group_id
    union
    select gr.owner_id, 'active', null, null, null, null, null
    from public.groups gr
    where gr.id = p_group_id
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
    case when m.status = 'active' then coalesce(pa.points, 0) + coalesce(sa.points, 0)
         else coalesce(m.frozen_points, 0) end as points,
    case when m.status = 'active' then coalesce(pa.wins, 0)
         else coalesce(m.frozen_wins, 0) end as wins,
    case when m.status = 'active' then coalesce(pa.losses, 0)
         else coalesce(m.frozen_losses, 0) end as losses,
    case when m.status = 'active' then coalesce(sa.storyteller_games, 0)
         else coalesce(m.frozen_storyteller_games, 0) end as storyteller_games,
    case when m.status = 'active' then coalesce(pa.games_played, 0) + coalesce(sa.storyteller_games, 0)
         else coalesce(m.frozen_games_played, 0) end as games_played,
    m.status
  from member_rows m
  left join player_agg pa on pa.user_id = m.user_id and m.status = 'active'
  left join st_agg sa on sa.user_id = m.user_id and m.status = 'active'
  order by points desc, wins desc;
$$;
