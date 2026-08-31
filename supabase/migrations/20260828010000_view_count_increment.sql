-- botchub — Phase 2 addition: view count increment
--
-- The "scripts" RLS policies only let a script's owner update its row, so an
-- anonymous visitor viewing a script detail page can't bump view_count via a
-- plain table update. A narrow SECURITY DEFINER function is the standard
-- Postgres/Supabase pattern for this: it does exactly one thing (increment
-- view_count for one row) and nothing else is exposed through it.

create or replace function public.increment_script_view_count(script_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.scripts set view_count = view_count + 1 where id = script_id;
end;
$$;

revoke all on function public.increment_script_view_count(uuid) from public;
grant execute on function public.increment_script_view_count(uuid) to anon, authenticated;
