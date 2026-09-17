-- botchub — broader/fuzzy keyword search on /scripts
--
-- Diego's feedback: "I mean I just couldn't find many scripts" and
-- "change the general keyword search to be a little more broad... a
-- nearest neighbor result instead of needing an exact match." The
-- previous search_scripts() (20260917000000) already did a substring
-- ILIKE match, which tolerates a partial word anywhere in the name/
-- description, but not a typo or near-miss (e.g. searching "confirmaton
-- bias" never found "An Artefact Of Confirmation Bias" — no substring of
-- one is a substring of the other). pg_trgm's similarity() scores by
-- shared 3-letter fragments, so it tolerates exactly that kind of
-- near-miss.
--
-- pg_trgm ships with Postgres/Supabase but wasn't enabled on this project
-- yet (confirmed via the extensions list) — installed into the same
-- `extensions` schema every other extension on this project already
-- lives in (Supabase's security advisor flags any extension left in
-- `public`), so every reference to it below is `extensions.`-qualified
-- to work under this function's locked-down `search_path = ''`.
create extension if not exists pg_trgm schema extensions;

-- GIN trigram indexes so the new similarity() checks (and the ILIKE
-- checks, which pg_trgm's operator class also accelerates) stay index-
-- backed rather than scanning every row — cheap now at ~30 scripts, but
-- free to add and this is exactly the column set search_scripts() reads.
create index if not exists scripts_name_trgm_idx
  on public.scripts using gin (name extensions.gin_trgm_ops);
create index if not exists scripts_description_trgm_idx
  on public.scripts using gin (description extensions.gin_trgm_ops);

-- Same parameter list and return columns as the previous version, so
-- this is a plain CREATE OR REPLACE.
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
      s.description ilike '%' || p_query || '%' or
      extensions.similarity(s.name, p_query) > 0.3 or
      (s.description is not null and extensions.similarity(s.description, p_query) > 0.3)
    )
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
    -- Only kicks in for the default "newest" sort with an actual search
    -- term — an explicit column sort (Name/Author/Type/Likes/Views, or
    -- Oldest) stays fully in the visitor's control, unaffected. Floats
    -- the closest name/description match to the top of the default feed
    -- instead of letting a great fuzzy match get buried by creation date,
    -- which would just reproduce the same "can't find it" complaint one
    -- layer down.
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
    case when p_sort is null or p_sort = 'newest' then s.created_at end desc,
    s.created_at desc,
    s.id
  limit p_limit offset p_offset;
$$;

revoke all on function public.search_scripts from public;
grant execute on function public.search_scripts to anon, authenticated;
