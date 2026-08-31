-- botchub — script browsing filters (Phase 2 follow-up)
--
-- Adds two columns the /scripts filter UI needs that weren't in the Phase 1
-- schema: script_type (Full vs Teensyville — botcscripts.com's own "Type"
-- distinction) and author, promoted out of script_json's _meta object into a
-- real column so it's filterable/indexable. script_json stays the source of
-- truth for everything else; author is duplicated here purely for querying
-- (Phase 4's upload flow should keep it in sync when script_json._meta.author
-- changes).
--
-- Also adds search_scripts(), a single SQL function backing the /scripts
-- page's combined name/type/author/include-characters/exclude-characters
-- filters with pagination. This replaces doing that combination through
-- chained PostgREST filters, which can't express "script contains ALL of
-- these characters" or "script contains NONE of these characters" cleanly.

alter table public.scripts
  add column if not exists script_type text not null default 'full'
    check (script_type in ('full', 'teensyville')),
  add column if not exists author text;

create index if not exists scripts_script_type_idx on public.scripts (script_type);
create index if not exists scripts_author_idx on public.scripts (author);

-- Backfill the 5 Phase 1 seed scripts from what's already in their script_json
-- _meta object / description, so existing data matches the new columns.
update public.scripts set author = 'The Pandemonium Institute', script_type = 'full'
  where name in ('Trouble Brewing', 'Bad Moon Rising', 'Sects & Violets');
update public.scripts set author = 'botchub (Phase 1 placeholder)', script_type = 'full'
  where name = 'The Golden Hour';
update public.scripts set author = 'botchub (Phase 1 placeholder)', script_type = 'teensyville'
  where name = 'Fogbound Isle';

create or replace function public.search_scripts(
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
