-- The 4 new SECURITY DEFINER helpers from the previous migration are
-- created with default PUBLIC EXECUTE, which the Supabase security linter
-- flags (anon/authenticated can call them directly via /rest/v1/rpc/...)
-- even though they only return booleans/ids and reveal nothing beyond
-- existence. Tighten to just the role that actually needs to invoke them
-- from within RLS policy evaluation (RLS policies run as the connecting
-- role, so `authenticated` must keep EXECUTE or the policies themselves
-- would fail).
revoke execute on function public.is_game_creator(uuid) from public;
revoke execute on function public.game_group_ids(uuid) from public;
revoke execute on function public.is_group_member_or_owner(uuid) from public;
revoke execute on function public.is_group_owner(uuid) from public;

grant execute on function public.is_game_creator(uuid) to authenticated;
grant execute on function public.game_group_ids(uuid) to authenticated;
grant execute on function public.is_group_member_or_owner(uuid) to authenticated;
grant execute on function public.is_group_owner(uuid) to authenticated;
