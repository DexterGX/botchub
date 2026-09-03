-- Phase 3: auto-create a public.profiles row whenever a new auth.users row
-- is created, whether that's email/password signup or a Google OAuth
-- sign-in. security definer is required because this runs during the
-- signup transaction, before the new user has an active session (so RLS's
-- "users can insert their own profile" policy, which checks auth.uid(),
-- wouldn't apply yet anyway).
--
-- username is intentionally left null here — there's no username-picker UI
-- yet, and the unique constraint on profiles.username allows any number of
-- nulls, so this is safe to backfill later.
--
-- Applied directly to the live project via the Supabase MCP tool
-- (2026-09-03); this file mirrors that change for the repo's migration
-- history.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
