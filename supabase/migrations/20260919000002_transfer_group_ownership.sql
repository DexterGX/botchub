-- Settings tab (owner-only): "transfer ownership" needs to change both
-- groups.owner_id and two group_members.role values together. Neither is
-- reachable with a plain client-side update:
--   - group_members has no UPDATE policy at all (only select/insert/delete),
--     so a plain role change is rejected outright.
--   - groups' own UPDATE policy ("owners can update their own groups") has
--     no explicit WITH CHECK, so Postgres reuses its USING clause
--     (auth.uid() = owner_id) as the check on the NEW row too — meaning an
--     owner can update their group's other columns, but can never set
--     owner_id to anyone but themselves; the update would be silently
--     rejected by RLS.
-- A SECURITY DEFINER function sidesteps both, same "narrow, purpose-built,
-- re-validates everything itself" shape as this feature's other privileged
-- functions (find_group_by_code, find_group_by_id) rather than loosening
-- either table's general RLS policies.
--
-- Ownership re-validated with `is distinct from`, not `<>` — for an
-- unauthenticated caller auth.uid() is NULL, and `anything <> NULL` is NULL
-- under SQL's three-valued logic, which plpgsql's `IF` treats the same as
-- false (silently skipping the "raise exception" branch instead of
-- rejecting the call). `is distinct from` treats NULL as a real,
-- comparable value, so a NULL auth.uid() correctly compares as
-- not-the-owner and hits the exception.
create or replace function public.transfer_group_ownership(
  p_group_id uuid,
  p_new_owner_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_owner uuid;
begin
  select owner_id into v_current_owner from public.groups where id = p_group_id;
  if v_current_owner is null then
    raise exception 'Group not found.';
  end if;
  if v_current_owner is distinct from (select auth.uid()) then
    raise exception 'Only the current owner can transfer ownership.';
  end if;
  if p_new_owner_id = v_current_owner then
    raise exception 'That member is already the owner.';
  end if;
  if not exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = p_new_owner_id
  ) then
    raise exception 'The new owner must already be a member of this group.';
  end if;

  update public.groups set owner_id = p_new_owner_id where id = p_group_id;
  update public.group_members set role = 'member'
    where group_id = p_group_id and user_id = v_current_owner;
  update public.group_members set role = 'owner'
    where group_id = p_group_id and user_id = p_new_owner_id;
end;
$$;

-- Owner-only in effect (the function re-checks auth.uid() itself) — granted
-- to authenticated only, not anon, since there's no legitimate signed-out
-- caller for this one (unlike find_group_by_code/find_group_by_id, which
-- intentionally serve not-yet-members). This project's default privileges
-- grant EXECUTE on every new function to PUBLIC *and* separately, directly,
-- to anon (not merely inherited through PUBLIC) — so narrowing this one
-- takes two explicit revokes, not just one; a `revoke ... from public`
-- alone leaves anon's own direct grant untouched. Belt-and-suspenders on
-- top of the auth.uid() check above, not a substitute for it.
revoke execute on function public.transfer_group_ownership(uuid, uuid) from public;
revoke execute on function public.transfer_group_ownership(uuid, uuid) from anon;
grant execute on function public.transfer_group_ownership(uuid, uuid) to authenticated;
