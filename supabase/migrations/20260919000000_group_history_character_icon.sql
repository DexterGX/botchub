-- Adds each History-tab row's character token icon (Diego's ask: "Add the
-- characters icons" to the group History list) — the same characters.icon_url
-- already joined in for character_name, just carried through as its own
-- output column instead of only using the join for the name.
--
-- `create or replace` can't change a function's OUT-parameter row shape
-- (Postgres error 42P13), so the old signature has to be dropped first.
drop function public.get_group_game_history(uuid, integer, integer);

create function public.get_group_game_history(
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
  character_icon_url text,
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
    c.icon_url as character_icon_url,
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
