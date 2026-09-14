-- botchub — preserve each script's own character order
--
-- Diego reported the generated PDF listing characters within a team in a
-- different order than the website's script page for the same script
-- (e.g. Washerwoman, Gossip, Pixie... vs. Washerwoman, Pixie, Sailor...).
-- Root cause: `script_characters` had no column recording a script's
-- author-intended character order (the order they appear in the script's
-- own `script_json` array) — both the website page and the PDF just read
-- `characters.filter(c => c.team === team)` over whatever order the
-- `script_characters` join query happened to return, and a query with no
-- `order by` has no guaranteed row order in Postgres/PostgREST. It can
-- (and evidently does) come back differently between two separate
-- requests, even for the exact same SQL text, which is why the PDF route
-- and the page — reading the identical data through the identical
-- function — could still disagree.
--
-- Fix: add a `position` column that records each character's index within
-- its script's own `script_json` array (excluding the `_meta` entry),
-- backfill it for every script/character link that already exists, and
-- have every future upload set it explicitly. `getCharactersForScript`
-- (lib/queries.ts) now orders by it, so both the website and the PDF read
-- characters in the same, deterministic, author-intended order.

alter table public.script_characters
  add column if not exists position integer not null default 0;

-- Backfill: for every script, unnest its script_json array with its index
-- (jsonb_array_elements ... with ordinality), resolve each entry (a bare
-- id string, an {id}-only object, or a full inline object) to the
-- characters row it links to for THAT script — official characters match
-- by character_id alone; homebrew characters are scoped to their
-- originating script_id, since character_id isn't unique across homebrew
-- rows from different scripts — and write that index as position.
with entries as (
  select
    s.id as script_id,
    elem.ordinality::int as position,
    case
      when jsonb_typeof(elem.value) = 'string' then elem.value #>> '{}'
      when jsonb_typeof(elem.value) = 'object' then elem.value ->> 'id'
      else null
    end as slug
  from public.scripts s
  cross join lateral jsonb_array_elements(
    case jsonb_typeof(s.script_json)
      when 'array' then s.script_json
      else '[]'::jsonb
    end
  ) with ordinality as elem(value, ordinality)
),
resolved as (
  select
    e.script_id,
    e.position,
    c.id as character_uuid
  from entries e
  join public.characters c
    on c.character_id = e.slug
    and (c.is_homebrew = false or c.source_script_id = e.script_id)
  where e.slug is not null and e.slug <> '_meta'
)
update public.script_characters sc
set position = r.position
from resolved r
where sc.script_id = r.script_id and sc.character_id = r.character_uuid;

create index if not exists script_characters_script_id_position_idx
  on public.script_characters (script_id, position);
