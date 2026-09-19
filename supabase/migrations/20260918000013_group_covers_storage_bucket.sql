-- group-covers: ready storage infrastructure for a future "upload a
-- cover photo" feature (v1 of the create-group form uses a plain URL
-- text field instead — no upload UI exists yet). Same public-bucket-
-- with-owner-scoped-write shape as script-art/script-pdfs/avatars.
--
-- NOTE: script-art's equivalent upload policy checks
-- storage.foldername(s.name) — the SCRIPTS table's name (title) column —
-- instead of the storage object's own path. That can never match a real
-- upload path, so it silently blocks every upload it's meant to allow;
-- it's just never been exercised because no script-art upload UI exists
-- either. Not fixed here (out of scope for Groups, and script-art is
-- pre-existing) — flagging for a future cleanup pass. The policies below
-- use the object's own path (storage.foldername(objects.name)) instead,
-- so this bucket doesn't inherit the same bug.
insert into storage.buckets (id, name, public)
values ('group-covers', 'group-covers', true);

create policy "public read of group covers"
  on storage.objects for select
  using (bucket_id = 'group-covers');

create policy "group owners can upload their group's cover"
  on storage.objects for insert
  with check (
    bucket_id = 'group-covers'
    and exists (
      select 1 from public.groups g
      where g.id::text = (storage.foldername(objects.name))[1]
        and g.owner_id = (select auth.uid())
    )
  );

create policy "group owners can replace their group's cover"
  on storage.objects for update
  using (
    bucket_id = 'group-covers'
    and exists (
      select 1 from public.groups g
      where g.id::text = (storage.foldername(objects.name))[1]
        and g.owner_id = (select auth.uid())
    )
  );
