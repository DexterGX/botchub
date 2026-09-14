-- Adds a free-text "Notes" field to scripts, for anything that doesn't fit
-- into a single character's ability text — homebrew/Bootlegger rule
-- clarifications, Fabled/Loric special-rule reminders, house rules, etc.
-- (matching what botcscripts.com shows as a script-level notes box).
-- Distinct from `description` (a short blurb shown near the title) — notes
-- are meant to be read alongside the character list, so the script detail
-- page renders them at the top of the Characters section instead.
--
-- No backfill: this is populated by whoever owns/uploads the script
-- (Phase 4), so it's null for every script that exists today.
alter table public.scripts
  add column notes text;
