-- Extends the schema-v1 sketch of games/game_players (0 rows in either,
-- never shipped to any UI yet) to match the actual Fast Log / Detailed Log
-- feature spec, and fixes a real RLS gap found along the way: the original
-- "games are readable when ungrouped or by group members" SELECT policy had
-- no `created_by = auth.uid()` clause on the ungrouped branch, meaning any
-- personal (no group) game log — the common case, since Groups doesn't even
-- have a UI yet — was readable by literally anyone, signed in or not.

-- 1. New fields Fast Log / Detailed Log actually need.
alter table public.games
  add column log_type text not null default 'fast'
    check (log_type in ('fast', 'detailed')),
  add column self_is_storyteller boolean not null default false,
  add column storyteller_mistakes boolean not null default false,
  add column duration text
    check (duration in ('under_45', 'from_45_to_90', 'from_90_to_135', 'over_135')),
  add column final_three boolean,
  add column last_phase text check (last_phase in ('day', 'night')),
  add column last_phase_number smallint check (last_phase_number > 0);

comment on column public.games.log_type is 'Which form was used to create this entry — Fast Log or Detailed Log.';
comment on column public.games.self_is_storyteller is 'Fast Log "Storyteller" checkbox — true means the logging user ran this game rather than playing a character. When true, no game_players row is created for them and their character/alignment fields are ignored.';
comment on column public.games.duration is 'Fast Log duration bucket, self-reported.';
comment on column public.games.final_three is 'Detailed Log only — whether the game reached final 3. Null for Fast Log entries (not asked).';
comment on column public.games.last_phase is 'Detailed Log only — Day or Night the game ended on.';
comment on column public.games.last_phase_number is 'Detailed Log only — which Day/Night number the game ended on (e.g. 3).';

-- 2. Replace the single `group_id` column with a many-to-many join table —
-- Diego wants a game log to be able to carry multiple group codes (it can
-- matter to more than one friend group's leaderboard at once). 0 rows exist
-- on games, so this is a clean cut, not a data migration. group_leaderboards
-- (sketched for the not-yet-built Phase 9) depends on the column, so it's
-- dropped and recreated against the new join table below rather than left
-- broken.
drop view public.group_leaderboards;

drop policy "games are readable when ungrouped or by group members" on public.games;
drop policy "group members can record games" on public.games;
drop policy "the creator or group owner can delete a game" on public.games;
drop policy "the creator or group owner can edit a game" on public.games;
drop policy "game_players follow the parent game's visibility" on public.game_players;
drop policy "the game's creator or group owner manages its players" on public.game_players;
drop policy "the game's creator or group owner updates its players" on public.game_players;
drop policy "the game's creator or group owner deletes its players" on public.game_players;

alter table public.games drop column group_id;

create table public.game_groups (
  game_id uuid not null references public.games(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (game_id, group_id)
);
comment on table public.game_groups is 'Which of a game log''s (possibly several) group codes it was tagged with — a game can count toward more than one friend group''s leaderboard.';

alter table public.game_groups enable row level security;

create view public.group_leaderboards
with (security_invoker = true) as
select
  gg.group_id,
  gp.user_id,
  count(*) as games_played,
  count(*) filter (where gp.won) as games_won,
  round(100.0 * count(*) filter (where gp.won)::numeric / nullif(count(*), 0)::numeric, 1) as win_rate_pct
from public.game_players gp
join public.games g on g.id = gp.game_id
join public.game_groups gg on gg.game_id = g.id
where gp.user_id is not null
group by gg.group_id, gp.user_id;

-- 3. Re-create RLS: creator always has full access to their own log; a
-- group code additionally exposes that one game (read-only) to that
-- group's members/owner. Simpler than before on UPDATE/DELETE — those are
-- creator-only now (a group owner editing someone else's personal log
-- entry was never something the app asked for).
create policy "the creator can see their own games"
  on public.games for select
  using (created_by = (select auth.uid()));

create policy "group members can see games tagged with their group"
  on public.games for select
  using (
    exists (
      select 1 from public.game_groups gg
      join public.group_members gm on gm.group_id = gg.group_id
      where gg.game_id = games.id and gm.user_id = (select auth.uid())
    )
    or exists (
      select 1 from public.game_groups gg
      join public.groups g on g.id = gg.group_id
      where gg.game_id = games.id and g.owner_id = (select auth.uid())
    )
  );

create policy "users log their own games"
  on public.games for insert
  with check (created_by = (select auth.uid()));

create policy "the creator can edit their own game"
  on public.games for update
  using (created_by = (select auth.uid()));

create policy "the creator can delete their own game"
  on public.games for delete
  using (created_by = (select auth.uid()));

create policy "game_players follow the parent game's visibility"
  on public.game_players for select
  using (
    exists (select 1 from public.games g where g.id = game_players.game_id and g.created_by = (select auth.uid()))
    or exists (
      select 1 from public.games g
      join public.game_groups gg on gg.game_id = g.id
      join public.group_members gm on gm.group_id = gg.group_id
      where g.id = game_players.game_id and gm.user_id = (select auth.uid())
    )
    or exists (
      select 1 from public.games g
      join public.game_groups gg on gg.game_id = g.id
      join public.groups gr on gr.id = gg.group_id
      where g.id = game_players.game_id and gr.owner_id = (select auth.uid())
    )
  );

create policy "the game's creator manages its players"
  on public.game_players for insert
  with check (
    exists (select 1 from public.games g where g.id = game_players.game_id and g.created_by = (select auth.uid()))
  );

create policy "the game's creator updates its players"
  on public.game_players for update
  using (
    exists (select 1 from public.games g where g.id = game_players.game_id and g.created_by = (select auth.uid()))
  );

create policy "the game's creator deletes its players"
  on public.game_players for delete
  using (
    exists (select 1 from public.games g where g.id = game_players.game_id and g.created_by = (select auth.uid()))
  );

-- 4. game_groups RLS: you may only tag your own game, and only with a
-- group you actually belong to (this doubles as the "is this a real code
-- I'm part of" check — an insert for a code you're not a member/owner of
-- is simply rejected).
create policy "the creator can see their game's group tags"
  on public.game_groups for select
  using (
    exists (select 1 from public.games g where g.id = game_groups.game_id and g.created_by = (select auth.uid()))
  );

create policy "group members can see a game tagged with their group"
  on public.game_groups for select
  using (
    exists (select 1 from public.group_members gm where gm.group_id = game_groups.group_id and gm.user_id = (select auth.uid()))
    or exists (select 1 from public.groups g where g.id = game_groups.group_id and g.owner_id = (select auth.uid()))
  );

create policy "the creator tags their own game with a group they belong to"
  on public.game_groups for insert
  with check (
    exists (select 1 from public.games g where g.id = game_groups.game_id and g.created_by = (select auth.uid()))
    and (
      exists (select 1 from public.group_members gm where gm.group_id = game_groups.group_id and gm.user_id = (select auth.uid()))
      or exists (select 1 from public.groups g where g.id = game_groups.group_id and g.owner_id = (select auth.uid()))
    )
  );

create policy "the creator removes a group tag from their own game"
  on public.game_groups for delete
  using (
    exists (select 1 from public.games g where g.id = game_groups.game_id and g.created_by = (select auth.uid()))
  );
