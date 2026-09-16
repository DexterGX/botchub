-- botchub — sortable Name/Author/Type columns on /scripts (Phase 2 follow-up)
--
-- The previous migration (20260916000000_search_scripts_sort.sql) added
-- p_sort but only for Likes/Views (plus the implicit newest/oldest
-- default). Diego asked for every column header except Actions to be
-- clickable, so this adds name_asc/name_desc, author_asc/author_desc and
-- type_asc/type_desc using the same "one CASE WHEN per direction" trick —
-- p_sort is constant across the whole query, so every row gets a real
-- value from exactly the matching CASE and NULL (an all-tied no-op) from
-- every other one.
--
-- The parameter list is unchanged from the previous migration, so this
-- can be a plain CREATE OR REPLACE rather than another DROP + CREATE.

create or replace function public.search_scripts(
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
    case when p_sort = 'name_asc' then s.name end asc,
    case when p_sort = 'name_desc' then s.name end desc,
    case when p_sort = 'author_asc' then s.author end asc,
    case when p_sort = 'author_desc' then s.author end desc,
    case when p_sort = 'type_asc' then s.script_type end asc,
    case when p_sort = 'type_desc' then s.script_type end desc,
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
