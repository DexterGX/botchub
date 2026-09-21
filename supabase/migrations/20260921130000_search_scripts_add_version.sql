-- Diego's ask: show each script's version next to its name in the browse
-- list, so two uploads of the same script (re-exports, revisions) read as
-- different rows instead of looking like duplicates. search_scripts()
-- never returned `version` at all — needs adding to its RETURNS TABLE
-- row shape, which `create or replace` can't do in place (42P13, same as
-- every other "add an output column" migration in this project) — drop
-- first.
drop function if exists public.search_scripts(text, text, text, text[], text[], integer, integer, text, numeric);

create function public.search_scripts(
  p_query text default null,
  p_type text default null,
  p_author text default null,
  p_include_character_ids text[] default null,
  p_exclude_character_ids text[] default null,
  p_limit integer default 20,
  p_offset integer default 0,
  p_sort text default 'newest',
  p_min_difficulty numeric default null
)
returns table (
  id uuid,
  name text,
  version text,
  description text,
  edition text,
  script_type text,
  author text,
  view_count integer,
  like_count bigint,
  created_at timestamptz,
  difficulty numeric,
  total_count bigint
)
language sql
stable
set search_path = ''
as $$
  select
    s.id,
    s.name,
    s.version,
    s.description,
    s.edition,
    s.script_type,
    s.author,
    s.view_count,
    (
      select count(*) from public.script_likes sl where sl.script_id = s.id
    ) as like_count,
    s.created_at,
    s.difficulty,
    count(*) over () as total_count
  from public.scripts s
  where
    (p_query is null or p_query = '' or
      s.name ilike '%' || p_query || '%' or
      s.description ilike '%' || p_query || '%' or
      extensions.similarity(s.name, p_query) > 0.3 or
      (s.description is not null and extensions.similarity(s.description, p_query) > 0.3)
    )
    and (p_type is null or s.script_type = p_type)
    and (p_author is null or p_author = '' or s.author ilike '%' || p_author || '%')
    and (p_min_difficulty is null or s.difficulty >= p_min_difficulty)
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
    case
      when (p_sort is null or p_sort = 'newest') and p_query is not null and p_query <> '' then
        greatest(
          extensions.similarity(s.name, p_query),
          coalesce(extensions.similarity(s.description, p_query), 0)
        )
    end desc,
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
    case when p_sort = 'most_difficult' then s.difficulty end desc,
    case when p_sort = 'least_difficult' then s.difficulty end asc,
    case when p_sort is null or p_sort = 'newest' then s.created_at end desc,
    s.created_at desc,
    s.id
  limit p_limit offset p_offset;
$$;
