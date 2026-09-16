-- Adds two new pieces of script-level metadata Diego asked for on the
-- script detail page header: a free-text "version" label (e.g. "1.0.0" --
-- not parsed/validated as real semver, purely what the uploader typed),
-- and a "category" classifying the script's character composition
-- (distinct from the existing `edition` column, which only ever
-- identifies one of the 3 official base scripts themselves).
--
-- `category` is auto-detected at upload time (see
-- lib/script-upload-actions.ts / ScriptUploadForm.tsx) from the script's
-- own characters: 'homebrew' if it introduces any non-official character,
-- 'base_three' if every character comes from Trouble Brewing/Bad Moon
-- Rising/Sects & Violets, 'custom' otherwise. The backfill below applies
-- that same rule to every script already in the database.
alter table public.scripts
  add column version text not null default '1.0.0',
  add column category text not null default 'custom'
    check (category in ('base_three', 'custom', 'homebrew'));

update public.scripts s
set category = case
  when exists (
    select 1
    from public.script_characters sc
    join public.characters c on c.id = sc.character_id
    where sc.script_id = s.id and c.is_homebrew = true
  ) then 'homebrew'
  when exists (
    select 1
    from public.script_characters sc
    where sc.script_id = s.id
  ) and not exists (
    select 1
    from public.script_characters sc
    join public.characters c on c.id = sc.character_id
    where sc.script_id = s.id
      and (c.edition is null or c.edition not in ('tb', 'bmr', 'snv'))
  ) then 'base_three'
  else 'custom'
end;
