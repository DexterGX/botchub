-- prevent_self_admin_grant() is a trigger function only — it should never
-- be invoked directly via PostgREST's /rpc/ endpoint, only fired by
-- profiles_lock_is_admin. This project's default privileges grant EXECUTE
-- on every new function to PUBLIC and directly to anon (same gotcha noted
-- on every other function-locking migration in this project), so it needs
-- explicit revokes to actually close that off, matching Supabase's own
-- advisor flag for this function.
revoke execute on function public.prevent_self_admin_grant() from public;
revoke execute on function public.prevent_self_admin_grant() from anon;
revoke execute on function public.prevent_self_admin_grant() from authenticated;
