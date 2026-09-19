-- Bug fix: getGroupById() and requestToJoinGroupAction() both did a plain
-- RLS-scoped `select ... from groups where id = ...`, which is invisible
-- for a PRIVATE group the viewer isn't a member of yet (RLS: "members and
-- the owner can see a group" OR "public groups are visible to everyone" —
-- neither matches). That made "Request to join" on a private group found
-- via search fail with "Group not found.", and would 404 /groups/[id]
-- entirely for the same case. Fixed the same way find_group_by_code()
-- already handles the analogous problem: a SECURITY DEFINER function that
-- only accepts an exact id (never a browsable listing), used as a
-- fallback when the plain RLS-scoped select comes back empty.
create or replace function public.find_group_by_id(p_group_id uuid)
returns setof public.groups
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.groups where id = p_group_id;
$$;

grant execute on function public.find_group_by_id(uuid) to authenticated, anon;
