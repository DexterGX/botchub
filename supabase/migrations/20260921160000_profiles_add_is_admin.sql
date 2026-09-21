-- Diego's ask (2026-09-21): gate /scripts/bulk-upload to admins only.
-- `is_admin` needs to be readable by the owning user (server-side gate
-- checks their own row) but must NOT be writable through the existing
-- "users can update their own profile" policy — that policy has no
-- column-level restriction, so without this trigger any signed-in user
-- could self-grant admin with a normal client-side profiles update.
--
-- The trigger only intervenes when the request is running as the
-- 'authenticated' Postgres role (i.e. a real end-user request through
-- PostgREST/the app) — auth.role() reads the JWT's role claim, which is
-- unset for a direct SQL statement run here (this migration itself, or
-- any future one-off grant), so admin status can only ever change via
-- direct database access, never through the app. Same
-- SECURITY DEFINER-over-a-broader-RLS-policy reasoning already used for
-- hide_left_group_membership and other narrow, user-can't-touch-this-
-- column cases in this project.
alter table public.profiles
  add column is_admin boolean not null default false;

create or replace function public.prevent_self_admin_grant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'authenticated' and new.is_admin is distinct from old.is_admin then
    new.is_admin := old.is_admin;
  end if;
  return new;
end;
$$;

create trigger profiles_lock_is_admin
before update on public.profiles
for each row
execute function public.prevent_self_admin_grant();

-- Diego's own account — the one admin-gated feature (bulk script upload)
-- exists for right now.
update public.profiles
set is_admin = true
where id = (select id from auth.users where email = 'diego.prgama00@gmail.com');
