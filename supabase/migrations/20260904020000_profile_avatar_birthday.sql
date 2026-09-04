-- Profile page polish, per Diego (2026-09-04): let visitors pick a BOTC
-- character token as their avatar (instead of / alongside their OAuth
-- picture), and add an optional, private birthday field.

-- avatar_character_id intentionally has NO foreign key constraint. The
-- natural reference target, characters.character_id, only carries a
-- *partial* unique index (characters_official_character_id_idx, scoped
-- WHERE is_homebrew = false — see 20260831020000_character_library_expansion.sql
-- for why that scoping exists), and Postgres foreign keys require a full
-- unique constraint/index on the referenced column, not a partial one.
-- Validated in the app layer instead: lib/profile-actions.ts's
-- setAvatarAction looks the submitted id up against the official,
-- non-homebrew character list before saving, the same trust boundary
-- script_characters.character_id values already rely on.
alter table public.profiles
  add column if not exists avatar_character_id text;

comment on column public.profiles.avatar_character_id is
  'Official characters.character_id of the token art the user chose as their avatar, if any (app-validated, no FK — see migration). Null falls back to avatar_url (the OAuth picture), then an initial-letter badge.';

-- Birthday lives in profile_private, not profiles, for the same reason
-- full_name does: a real person's exact birth date is more sensitive than
-- anything else on this page, and RLS filters rows, not columns, so it
-- can't safely sit on the publicly-readable profiles table. Nothing reads
-- it yet beyond the account page's own editor — this just means a future
-- "upcoming birthdays" feature could only ever be opt-in, never a retrofit
-- onto data that was already public.
alter table public.profile_private
  add column if not exists birthday date;
