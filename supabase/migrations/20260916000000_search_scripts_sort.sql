-- botchub — sortable /scripts browse list (Phase 2 follow-up)
--
-- search_scripts() has always ordered by created_at desc with no way to
-- change it. Diego asked for a sort control (most/fewest views, most/
-- fewest likes, in addition to newest/oldest). Adds a `p_sort` parameter
-- rather than building it client-side, since sorting has to happen before
-- the LIMIT/OFFSET pagination for it to mean anything across pages.
--
-- The CASE-per-direction trick below is the standard way to parameterize
-- ORDER BY in a SQL function without resorting to dynamic SQL: p_sort is
-- constant for the whole query (not a per-row value), so every row gets a
-- real value from exactly one CASE expression (the one matching p_sort)
-- and NULL from all the others — the NULL columns are all-NULL ties that
-- contribute no ordering signal, so Postgres falls through to whichever
-- CASE actually produced real values, then to the final s.id tie-break
-- for fully deterministic pagination.
--
-- Return type is unchanged, but the parameter list is (a new one added at
-- the end) — CREATE OR REPLACE can't add a parameter to a function this
-- way without it being treated as a distinct overload, so this drops and
-- recreates it, same as the like_count migration before it.

drop function if exists public.search_scripts(
  text, text, text, text[], text[], integer, integer
);

create function public.search_scripts(
  p_query text default null,
  p_type text default null,
  p_author text default null,
  p_include_character_ids text[] default null,
  p_exclude_character_ids text[] default null,
  p_limit integer default 20,
  p_offset integer default 0,
  p_sort text default 'newest'
)
returns table (
  id uuid,
  name text,
  description text,
  edition text,
  script_type text,
  author text,
  view_count integer,
  like_count bigint,
  created_at timestamptz,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    s.id,
    s.name,
    s.description,
    s.edition,
    s.script_type,
    s.author,
    s.view_count,
    (
      select count(*) from public.script_likes sl where sl.script_id = s.id
    ) as like_count,
    s.created_at,
    count(*) over () as total_count
  from public.scripts s
  where
    (p_query is null or p_query = '' or
      s.name ilike '%' || p_query || '%' or
      s.description ilike '%' || p_query || '%')
    and (p_type is null or s.script_type = p_type)
    and (p_author is null or p_author = '' or s.author ilike '%' || p_author || '%')
    and (
      p_include_character_ids is null or array_length(p_include_character_ids, 1) is null or (
        select count(distinct c.character_id)
        from public.script_characters sc
        join public.characters c on c.id = sc.character_id
        where sc.script_id = s.id and c.character_id = any (p_include_character_ids)
      ) = array_length(p_include_character_ids, 1)
    )
    and (
      p_exclude_character_ids is null or array_length(p_exclude_character_ids, 1) is null or not exists (
        select 1
        from public.script_characters sc
        join public.characters c on c.id = sc.character_id
        where sc.script_id = s.id and c.character_id = any (p_exclude_character_ids)
      )
    )
  order by
    case when p_sort = 'oldest' then s.created_at end asc,
    case when p_sort = 'most_views' then s.view_count end desc,
    case when p_sort = 'fewest_views' then s.view_count end asc,
    case when p_sort = 'most_likes' then (
      select count(*) from public.script_likes sl where sl.script_id = s.id
    ) end desc,
    case when p_sort = 'fewest_likes' then (
      select count(*) from public.script_likes sl where sl.script_id = s.id
    ) end asc,
    case when p_sort is null or p_sort = 'newest' then s.created_at end desc,
    s.created_at desc,
    s.id
  limit p_limit offset p_offset;
$$;

revoke all on function public.search_scripts from public;
grant execute on function public.search_scripts to anon, authenticated;
