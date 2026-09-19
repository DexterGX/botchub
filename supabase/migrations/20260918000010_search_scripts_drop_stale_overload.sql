-- CREATE OR REPLACE with a new trailing parameter created a second
-- overload instead of replacing the function in place (Postgres
-- overload identity includes the parameter list, not just the name) —
-- left both the old 8-arg and new 9-arg search_scripts() coexisting,
-- which would leave PostgREST/supabase-js ambiguous about which to call.
-- Drop the stale 8-arg one; the 9-arg version (with p_min_difficulty) is
-- the only one that should remain.
drop function public.search_scripts(text, text, text, text[], text[], integer, integer, text);

grant execute on function public.search_scripts(text, text, text, text[], text[], integer, integer, text, numeric) to authenticated, anon;
