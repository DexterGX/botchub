-- Phase 4 (JSON upload) needs an authenticated user's normal session client
-- (anon key + RLS, not the service role — this project has no service-role
-- key configured) to be able to:
--   (a) insert new homebrew `characters` rows for any character an uploaded
--       script defines inline (not just references by official id), and
--   (b) insert `script_characters` rows linking every character (official
--       and new homebrew alike) to the script being created.
--
-- Neither table had an insert policy before now — the original schema
-- comment on `characters` assumed service-role writes, which isn't the
-- path this app actually has available. Both new policies follow the same
-- shape already used elsewhere for tables without their own owner column
-- (e.g. `script_tags`, `collection_scripts`): tie the write back to a
-- `scripts` row the authenticated user actually owns.

-- A homebrew character must declare where it came from (source_script_id)
-- and that script must belong to the uploader. Official characters
-- (is_homebrew = false) are still never insertable through this policy —
-- those are seeded separately.
create policy "owners can insert homebrew characters for their own scripts"
  on public.characters for insert
  with check (
    is_homebrew
    and source_script_id is not null
    and exists (
      select 1 from public.scripts s
      where s.id = source_script_id and s.owner_id = (select auth.uid())
    )
  );

create policy "owners can link characters to their own scripts"
  on public.script_characters for insert
  with check (
    exists (
      select 1 from public.scripts s
      where s.id = script_id and s.owner_id = (select auth.uid())
    )
  );
