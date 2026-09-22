-- Adds sync-related columns to scripts and a small state table for the
-- automated botcscripts.com library sync (Diego's ask, 2026-09-22 — see
-- claude/decisions.md for the reversal of the earlier "no automated
-- scraping" decision this implements, and supabase/functions/
-- botcscripts-sync for the actual fetch/upsert logic).

alter table public.scripts
  add column source text not null default 'user'
    check (source = any (array['user', 'botcscripts_sync'])),
  add column external_script_id integer,
  add column external_pk integer,
  add column content_hash text,
  add column last_synced_at timestamptz;

comment on column public.scripts.source is 'Where this script row came from: a real uploader (''user'', the default) or the automated botcscripts.com sync (''botcscripts_sync'').';
comment on column public.scripts.external_script_id is 'botcscripts.com''s own script_id (groups that script''s versions together) — the de-dup key for the sync, so re-syncing updates the same row instead of creating a duplicate. Null for user-uploaded scripts.';
comment on column public.scripts.external_pk is 'botcscripts.com''s pk for the specific version most recently synced — informational only (their pk changes with every new version), not used for de-dup.';
comment on column public.scripts.content_hash is 'sha256 of the synced script''s content array, so the sync can tell "nothing changed" from "needs a re-import" without diffing JSON on every run.';
comment on column public.scripts.last_synced_at is 'When the automated sync last wrote (or confirmed unchanged) this row. Null for user-uploaded scripts.';

-- Keeps the two sync fields internally consistent: a user upload never
-- carries an external id, and a synced row always does (plus has no
-- owner — it wasn't uploaded by any BOTChub account).
alter table public.scripts
  add constraint scripts_sync_fields_check
  check (
    (source = 'user' and external_script_id is null)
    or (source = 'botcscripts_sync' and external_script_id is not null and owner_id is null)
  );

-- One row per external script, so a re-sync updates in place instead of
-- creating a duplicate.
create unique index scripts_external_script_id_key
  on public.scripts (external_script_id)
  where source = 'botcscripts_sync';

-- Cursor + status for the paginated sync — a single row, advanced one
-- botcscripts.com results page per cron run (see supabase/functions/
-- botcscripts-sync). Deliberately one page per run rather than the whole
-- ~11k-script library every 10 minutes: gentler on botcscripts.com, and
-- matches what Diego was told botc.games' own sync does ("fetches... every
-- 10 min"). A full pass over the library takes roughly 36 hours at 50
-- scripts/page/10min before it wraps back to page 1 and starts checking
-- for updates/new scripts again.
create table public.botcscripts_sync_state (
  id boolean primary key default true check (id),
  next_page integer not null default 1,
  total_pages integer,
  last_run_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  scripts_synced integer not null default 0
);
insert into public.botcscripts_sync_state (id) values (true);

alter table public.botcscripts_sync_state enable row level security;
-- No policies: this is internal sync bookkeeping, not user data. The sync
-- Edge Function runs with the service-role key, which bypasses RLS
-- entirely, so it doesn't need a policy here — and nothing else (no
-- anon/authenticated request) should be able to read or write it.
