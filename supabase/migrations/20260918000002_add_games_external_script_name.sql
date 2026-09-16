-- Supports the "+ Script Outside DB" option: when a player logs a game for
-- a script that isn't in botchub's scripts table, they can type a
-- freeform name instead of picking a real script_id. Nullable, and mutually
-- exclusive with script_id in application logic (exactly one should be set).
alter table public.games add column external_script_name text;
comment on column public.games.external_script_name is 'Freeform script name entered via "+ Script Outside DB" when the played script is not in the scripts table. Mutually exclusive with script_id in application logic.';
