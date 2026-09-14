-- botchub — surface a script's Bootlegger house-rule text
--
-- Diego: "it also doesnt show the bootlegger's notes that the scripts
-- contains" — a script's uploaded JSON _meta entry can carry a
-- `bootlegger` field (per the official script-schema.json: an array of up
-- to 10 strings, each a custom homebrew-rule clarification — distinct
-- from the Bootlegger character's own fixed ability text, "This script
-- has homebrew characters or rules.", which is just a pointer to these).
-- This app never parsed or stored that field — a script with real
-- Bootlegger rule text lost it silently on upload, keeping only the
-- generic Bootlegger character badge with nothing explaining what the
-- actual house rules are.
--
-- Fix: a new bootlegger_rules text[] column, backfilled here from every
-- existing script's own already-stored script_json (same "the JSON is the
-- source of truth" approach as the character-position backfill), and
-- written explicitly by future uploads (lib/scriptValidation.ts,
-- lib/script-upload-actions.ts).

alter table public.scripts
  add column if not exists bootlegger_rules text[];

update public.scripts s
set bootlegger_rules = backfill.rules
from (
  select
    s2.id as script_id,
    array(select jsonb_array_elements_text(meta.value -> 'bootlegger')) as rules
  from public.scripts s2
  cross join lateral jsonb_array_elements(
    case jsonb_typeof(s2.script_json)
      when 'array' then s2.script_json
      else '[]'::jsonb
    end
  ) as meta(value)
  where meta.value ->> 'id' = '_meta'
    and jsonb_typeof(meta.value -> 'bootlegger') = 'array'
    and jsonb_array_length(meta.value -> 'bootlegger') > 0
) as backfill
where s.id = backfill.script_id;
