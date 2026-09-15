-- Onboarding gets two new fields, per Diego (2026-09-15): a birthday
-- input (the column already exists — profile_private.birthday, added in
-- 20260904020000_profile_avatar_birthday.sql for the /account editor —
-- this just lets it be set at signup time too, no schema change needed
-- for that one) and a new "how did you hear about BOTChub?" question.

-- referral_source lives in profile_private, not profiles, for the same
-- reason full_name/birthday do: RLS filters rows, not columns, so
-- anything that shouldn't be publicly readable has to sit on the
-- owner-only table. It's a fixed set of options (matching the onboarding
-- form's <select>) plus a free-text column for when the visitor picks
-- "other" — both optional, and neither backfilled for existing accounts
-- (this is a one-time signup-flow question, not something surfaced for
-- editing later on /account).
alter table public.profile_private
  add column if not exists referral_source text
    check (referral_source in ('clocktower_con', 'discord', 'friends', 'other')),
  add column if not exists referral_source_other text;

comment on column public.profile_private.referral_source is
  'How a visitor said they heard about BOTChub, asked once during onboarding. Null for every account created before this column existed, and for anyone who skipped the question.';
comment on column public.profile_private.referral_source_other is
  'Free-text detail when referral_source = ''other''. Not validated against referral_source at the DB level (same looseness as e.g. profiles.region not being checked against country) — the app only ever writes it alongside ''other''.';
