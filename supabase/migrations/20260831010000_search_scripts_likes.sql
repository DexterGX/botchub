-- botchub — add like_count to search_scripts() (Phase 2 follow-up)
--
-- The /scripts table now shows a Likes column, matching botcscripts.com's
-- own listing. script_likes already existed from the Phase 1 schema (it's
-- just empty until Phase 3 auth + Phase 5's like button exist) — this only
-- adds the count into search_scripts()'s result set. Return type is
-- changing (a new output column), which CREATE OR REPLACE can't do for a
-- RETURNS TABLE function, so this drops and recreates it.

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
  p_offset integer default 0
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
  order by s.created_at desc
  limit p_limit offset p_offset;
$$;

revoke all on function public.search_scripts from public;
grant execute on function public.search_scripts to anon, authenticated;
