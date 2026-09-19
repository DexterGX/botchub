-- Groups & Leaderboard (Diego's spec): adds everything the /groups*
-- pages need on top of the groups/group_members tables that already
-- existed (Phase 9 placeholder + the games/game_groups tagging feature).

-- 1. groups: the new fields the create-group form and cards need.
alter table public.groups
  add column description text,
  add column visibility text not null default 'private' check (visibility in ('private', 'public')),
  add column cover_image_url text,
  add column playtime_start date,
  add column playtime_end date,
  add column count_wins boolean not null default true,
  add column win_points integer not null default 3,
  add column win_points_mistake integer not null default 1,
  add column count_losses boolean not null default true,
  add column loss_points integer not null default -3,
  add column loss_points_mistake integer not null default -1,
  add column count_storyteller boolean not null default false,
  add column storyteller_points integer not null default 2,
  add column storyteller_points_mistake integer not null default 1;

-- 2. invite_code becomes the human-facing "ID#" (one letter + 4 digits,
-- e.g. D4423) instead of the placeholder 8-char md5 slice, with a
-- collision-retry loop since the format has a much smaller space.
create or replace function public.generate_group_invite_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate text;
  tries int := 0;
begin
  loop
    candidate := chr(65 + floor(random() * 26)::int) || lpad(floor(random() * 10000)::int::text, 4, '0');
    if not exists (select 1 from public.groups where invite_code = candidate) then
      return candidate;
    end if;
    tries := tries + 1;
    if tries > 20 then
      raise exception 'Could not generate a unique group invite code after % tries', tries;
    end if;
  end loop;
end;
$$;

alter table public.groups
  alter column invite_code set default public.generate_group_invite_code();

-- 3. group_join_requests — the approval workflow for private groups
-- ("request to join", owner approves/rejects, "waiting for response").
create table public.group_join_requests (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (group_id, user_id)
);

alter table public.group_join_requests enable row level security;

create policy "a user requests to join a group"
  on public.group_join_requests for insert
  with check (user_id = (select auth.uid()));

create policy "requester or owner can see a join request"
  on public.group_join_requests for select
  using (
    user_id = (select auth.uid())
    or public.is_group_owner(group_id)
  );

create policy "requester re-requests or withdraws; owner responds"
  on public.group_join_requests for update
  using (
    user_id = (select auth.uid())
    or public.is_group_owner(group_id)
  );

create policy "requester withdraws their own pending request"
  on public.group_join_requests for delete
  using (user_id = (select auth.uid()));

-- 4. groups: a public group is listable by anyone (browsing /groups/join),
-- on top of the existing "members and the owner can see a group" policy.
create policy "public groups are visible to everyone"
  on public.groups for select
  using (visibility = 'public');

-- 5. group_members: the single self-join-as-anyone policy from the
-- Phase 9 placeholder let a self-insert with ANY role (including
-- 'owner') into any group. Replace it with three narrower, purpose-
-- specific policies now that real join flows exist.
drop policy "users can join a group as themselves" on public.group_members;

create policy "owner joins their own new group"
  on public.group_members for insert
  with check (
    role = 'owner'
    and user_id = (select auth.uid())
    and public.is_group_owner(group_id)
  );

create policy "self-join a public group"
  on public.group_members for insert
  with check (
    role = 'member'
    and user_id = (select auth.uid())
    and exists (select 1 from public.groups g where g.id = group_id and g.visibility = 'public')
  );

create policy "owner adds a member whose join request they approved"
  on public.group_members for insert
  with check (
    role = 'member'
    and public.is_group_owner(group_id)
    and exists (
      select 1 from public.group_join_requests r
      where r.group_id = group_members.group_id
        and r.user_id = group_members.user_id
        and r.status in ('pending', 'approved')
    )
  );

-- 6. group_members: the old SELECT policy only let a member see their OWN
-- row (or the owner see everything) — too narrow for the Players tab,
-- which needs every member visible to every member.
drop policy "members can see the membership list of their own groups" on public.group_members;

create policy "any member (or the owner) can see the full membership list"
  on public.group_members for select
  using (public.is_group_member_or_owner(group_id));

-- 7. find_group_by_code — the one lookup allowed to reach a private,
-- not-yet-joined group by its exact ID#, without widening groups' own
-- RLS to a browsable "everyone can see everything" policy.
create or replace function public.find_group_by_code(p_code text)
returns table (
  id uuid,
  name text,
  description text,
  visibility text,
  invite_code text,
  cover_image_url text,
  member_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    g.id, g.name, g.description, g.visibility, g.invite_code, g.cover_image_url,
    (select count(*) from public.group_members gm where gm.group_id = g.id) as member_count
  from public.groups g
  where g.invite_code = upper(trim(p_code));
$$;

grant execute on function public.find_group_by_code(text) to authenticated, anon;
