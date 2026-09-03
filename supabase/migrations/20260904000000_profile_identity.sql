-- Phase 3 follow-up: profile identity (display name + Discord-style tag,
-- private real name, location) per Diego's spec, 2026-09-04.
--
-- Public-safe fields (things fine to show other users, once other
-- features read them) stay on public.profiles, which anyone can already
-- SELECT. The user's real name is NOT public, so it lives in its own
-- table with owner-only RLS — Postgres RLS filters rows, not columns, so
-- a private column can't safely sit next to public ones on the same
-- publicly-readable table.
--
-- Applied directly to the live project via the Supabase MCP tool
-- (2026-09-04); this file mirrors that change for the repo's migration
-- history.

alter table public.profiles
  add column if not exists tag char(4),
  add column if not exists country text,
  add column if not exists region text;

comment on column public.profiles.username is
  'Reserved for a possible future vanity handle/URL. Not used yet — the
   display_name + tag pair (Discord-style) is the actual public identity
   as of the 2026-09-04 profile-identity migration.';
comment on column public.profiles.tag is
  '4-digit zero-padded string, paired with display_name the way Discord
   pairs a name with a #1234 tag, since display_name itself is not
   unique. Assigned/reassigned only via public.set_display_name(), never
   written directly — that function''s retry loop is what guarantees the
   (display_name, tag) pair stays unique.';

-- One display_name can be shared by many users, but each (name, tag) pair
-- must be unique. Case-insensitive so "Diego" and "diego" can't both grab
-- the same tag out from under each other. Partial index (display_name is
-- not null) because every pre-onboarding profile has null/null, which a
-- plain unique index would otherwise only allow one of.
create unique index if not exists profiles_display_name_tag_key
  on public.profiles (lower(display_name), tag)
  where display_name is not null;

-- =========================================================================
-- profile_private — the user's real name. Never exposed by the existing
-- "profiles are publicly readable" policy on public.profiles; this table
-- has its own RLS, owner-only, no public SELECT policy at all.
-- =========================================================================
create table if not exists public.profile_private (
  id uuid primary key references public.profiles (id) on delete cascade,
  full_name text,
  updated_at timestamptz not null default now()
);

alter table public.profile_private enable row level security;

create policy "users can read their own private profile info"
  on public.profile_private for select
  using ((select auth.uid()) = id);

create policy "users can insert their own private profile info"
  on public.profile_private for insert
  with check ((select auth.uid()) = id);

create policy "users can update their own private profile info"
  on public.profile_private for update
  using ((select auth.uid()) = id);

create trigger profile_private_set_updated_at
  before update on public.profile_private
  for each row execute function public.set_updated_at();

-- =========================================================================
-- handle_new_user — replaces the Phase 3 version. No longer seeds
-- display_name from Google's profile data: the display name is the
-- public "gamer name" and must be chosen deliberately (enforced by the
-- app's onboarding gate, not this trigger), kept separate from the real
-- name, which Google *does* prefill here — into the private table.
-- =========================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do nothing;

  insert into public.profile_private (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- =========================================================================
-- set_display_name — atomically assigns display_name + a free 4-digit tag.
-- security invoker (not definer): runs as the calling user, so the
-- existing "users can update their own profile" RLS policy is what
-- actually authorizes the write — this function only adds the retry loop
-- for tag collisions, not any elevated privilege. Also how a user later
-- "rerolls" their tag: call again with the same name, get a new tag.
-- =========================================================================
create or replace function public.set_display_name(p_display_name text)
returns public.profiles
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_name text := trim(p_display_name);
  v_tag text;
  v_attempt int := 0;
  v_result public.profiles;
begin
  if v_name is null or length(v_name) < 2 or length(v_name) > 32 then
    raise exception 'Display name must be between 2 and 32 characters.';
  end if;
  if v_name like '%#%' then
    raise exception 'Display name can''t contain "#".';
  end if;

  loop
    v_attempt := v_attempt + 1;
    v_tag := lpad(floor(random() * 10000)::int::text, 4, '0');
    begin
      update public.profiles
        set display_name = v_name, tag = v_tag
        where id = (select auth.uid())
        returning * into v_result;
      return v_result;
    exception when unique_violation then
      if v_attempt >= 25 then
        raise exception 'That name is very popular right now — try a slightly different one.';
      end if;
      -- fall through and loop again with a freshly rolled tag
    end;
  end loop;
end;
$$;

grant execute on function public.set_display_name(text) to authenticated;
