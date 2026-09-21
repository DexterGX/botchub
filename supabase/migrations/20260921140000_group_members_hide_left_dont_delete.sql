-- Bug fix (Diego): the /groups card's "remove this old group from my list"
-- action was hard-deleting the group_members row for a left membership.
-- That row isn't just "my card" though — get_group_leaderboard() reads it
-- for EVERY member still in the group (frozen points/wins/losses, shown
-- with a "Quit" tag), so deleting it made someone who'd quit silently
-- vanish from the shared leaderboard/ranked list for everyone else too,
-- not just off the ex-member's own /groups page. Fix: add a per-row flag
-- that only affects whether *that row's own user* still sees a card for
-- it on their /groups list; get_group_leaderboard() never looks at this
-- column, so the row (and the "Quit" tag) keeps showing for the group's
-- remaining members regardless of what the ex-member does with their own
-- list.
alter table public.group_members
  add column if not exists hidden_from_own_list boolean not null default false;

-- SECURITY DEFINER (same shape as leave_group()) rather than a new RLS
-- UPDATE policy: an UPDATE policy on group_members would only be able to
-- gate *which rows* a member can touch, not *which columns* — a member
-- could then also rewrite their own frozen_points/frozen_wins on a left
-- row they still partly control via RLS. Routing this one specific,
-- narrow change through a function keeps "hide my own stale card" from
-- ever becoming "edit my own frozen stats".
create or replace function public.hide_left_group_membership(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated boolean;
begin
  update public.group_members
    set hidden_from_own_list = true
    where group_id = p_group_id
      and user_id = (select auth.uid())
      and status = 'left'
    returning true into v_updated;

  if v_updated is not true then
    raise exception 'Leave the group first.';
  end if;
end;
$$;

revoke all on function public.hide_left_group_membership(uuid) from public;
revoke all on function public.hide_left_group_membership(uuid) from anon;
grant execute on function public.hide_left_group_membership(uuid) to authenticated;
