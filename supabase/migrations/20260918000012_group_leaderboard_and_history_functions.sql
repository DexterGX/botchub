-- Backs the group detail page's Players tab (leaderboard) and History
-- tab (per-player-per-game cards).

-- get_group_leaderboard: points per member, computed from the group's own
-- points-distribution config rather than a fixed formula. player_agg and
-- st_agg each aggregate by user_id independently first, then LEFT JOIN
-- onto member_ids (1:1 or 1:0) — deliberately not one CTE joining
-- player_events to st_events directly on user_id, which would fan out
-- (e.g. 3 player rows x 2 storyteller rows = 6, double-counting sum()).
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
    select gm.user_id from public.group_members gm where gm.group_id = p_group_id
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

grant execute on function public.get_group_leaderboard(uuid) to authenticated, anon;

-- get_group_game_history: one row per (game, player) tagged to the group,
-- newest first, paginated. self_is_storyteller/storyteller_* are
-- attributes of the GAME (whoever logged it), repeated on every row of
-- that game — not a flag meaning "this particular row is the storyteller
-- row". A game logged by its Storyteller with no game_players rows at all
-- (a Fast Log with nobody else entered) still produces exactly one row,
-- with every player_* column null, via the left join.
create or replace function public.get_group_game_history(
  p_group_id uuid,
  p_limit integer default 30,
  p_offset integer default 0
)
returns table (
  game_id uuid,
  played_at timestamptz,
  script_name text,
  self_is_storyteller boolean,
  storyteller_user_id uuid,
  storyteller_display_name text,
  player_user_id uuid,
  player_display_name text,
  team text,
  won boolean,
  character_name text,
  total_count bigint
)
language sql
stable
set search_path = ''
as $$
  select
    ga.id as game_id,
    ga.played_at,
    coalesce(s.name, ga.external_script_name) as script_name,
    ga.self_is_storyteller,
    case when ga.self_is_storyteller then ga.created_by end as storyteller_user_id,
    case when ga.self_is_storyteller then p.display_name end as storyteller_display_name,
    gp.user_id as player_user_id,
    coalesce(prof.display_name, gp.display_name) as player_display_name,
    gp.team,
    gp.won,
    c.name as character_name,
    count(*) over () as total_count
  from public.game_groups gg
  join public.games ga on ga.id = gg.game_id
  left join public.scripts s on s.id = ga.script_id
  left join public.game_players gp on gp.game_id = ga.id
  left join public.profiles prof on prof.id = gp.user_id
  left join public.characters c on c.id = gp.character_id
  left join public.profiles p on p.id = ga.created_by
  where gg.group_id = p_group_id
  order by ga.played_at desc, ga.id, gp.id
  limit p_limit offset p_offset;
$$;

grant execute on function public.get_group_game_history(uuid, integer, integer) to authenticated, anon;
