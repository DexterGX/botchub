-- Diego's ask: show the auto-computed difficulty stars on the upload form
-- itself (before submit), and let the user override the number if they
-- disagree. The scoring math previously lived entirely inside
-- compute_script_difficulty(p_script_id), which only works for a script
-- that's already been saved (it reads script_characters/characters rows
-- by id) — no good for a form that hasn't submitted yet.
--
-- Pulled the actual formula out into its own pure function that scores
-- from plain arrays instead of a script_id, so the exact same math can
-- run against an in-progress upload's parsed JSON. compute_script_difficulty
-- becomes a thin wrapper: gather this script's persisted data, hand it to
-- the shared scorer. Output is unchanged for every already-uploaded
-- script — same formula, just relocated (verified by recomputing every
-- existing script with a difficulty set and diffing against the stored
-- value before shipping this).
create or replace function public.score_script_characters(
  p_names text[],
  p_teams text[],
  p_abilities text[],
  p_other_nights integer[],
  p_jinx_count integer,
  p_has_bootlegger boolean
)
returns numeric
language sql
immutable
set search_path = ''
as $$
  with rows as (
    select
      unnest(p_names) as name,
      unnest(p_teams) as team,
      unnest(p_abilities) as ability,
      unnest(p_other_nights) as other_night
  ),
  agg as (
    select
      count(*) filter (where ability ~* '(poison|drunk)') as poison_drunk_count,
      count(*) filter (where name in ('Lunatic', 'Marionette') or ability ~* '\ymad\y') as madness_count,
      count(*) filter (
        where team not in ('fabled', 'loric')
          and ability ~* '(thinks (that )?(he|she|they|you) (is|are)|register(s)?\s+as|you are actually|(gain|lose)s?\s+(a|this|their)\s+ability|(becomes?|become)\s+(the|a|an)\s+|is not the character|counts? as (good|evil|a demon|a minion|a townsfolk|an outsider)|swap|switch (their )?character|if.*(win|wins).*(good|evil)|you (might|may) (be|become))'
      ) as align_count,
      count(*) filter (
        where team <> 'demon'
          and ability ~* '(die|death)'
          and ability !~* '(can.?t|cannot|don.?t|won.?t)\s*die'
      ) as kill_count,
      count(*) filter (where ability ~* '\y(win|wins|lose|loses)\y') as ending_count,
      count(*) filter (where coalesce(other_night, 0) > 0) as night_count,
      count(*) filter (where team in ('fabled', 'loric')) as fabled_loric_count
    from rows
  )
  select
    1.0
    + case when agg.poison_drunk_count >= 6 then 0.5 when agg.poison_drunk_count >= 4 then 0.25 else 0 end
    + case when agg.madness_count >= 3 then 0.5 when agg.madness_count >= 1 then 0.25 else 0 end
    + case when agg.align_count >= 3 then 0.5 when agg.align_count >= 2 then 0.25 else 0 end
    + case when agg.kill_count >= 6 then 0.5 when agg.kill_count >= 4 then 0.25 else 0 end
    + case when agg.ending_count >= 5 then 0.5 when agg.ending_count >= 4 then 0.25 else 0 end
    + case when agg.night_count >= 11 then 0.5 when agg.night_count >= 8 then 0.25 else 0 end
    + case when p_jinx_count >= 5 then 0.5 when p_jinx_count >= 3 then 0.25 else 0 end
    + case
        when agg.fabled_loric_count >= 3 and p_has_bootlegger then 1.5
        when agg.fabled_loric_count >= 3 then 0.5
        when agg.fabled_loric_count >= 1 then 0.25
        else 0
      end
  from agg;
$$;

-- Same anon/PUBLIC lockdown convention as every other authenticated-only
-- RPC in this project (its default privileges grant EXECUTE to PUBLIC
-- *and* separately, directly, to anon — both need an explicit revoke).
revoke execute on function public.score_script_characters(text[], text[], text[], integer[], integer, boolean) from public;
revoke execute on function public.score_script_characters(text[], text[], text[], integer[], integer, boolean) from anon;
grant execute on function public.score_script_characters(text[], text[], text[], integer[], integer, boolean) to authenticated;

create or replace function public.compute_script_difficulty(p_script_id uuid)
returns numeric
language sql
stable
set search_path = ''
as $$
  with chars as (
    select c.name, c.team, c.ability, c.other_night
    from public.script_characters sca
    join public.characters c on c.id = sca.character_id
    where sca.script_id = p_script_id
  ),
  jinx as (
    select count(distinct cj.id) as jinx_count
    from public.script_characters sca
    join public.character_jinxes cj
      on cj.character_a_id = sca.character_id or cj.character_b_id = sca.character_id
    join public.script_characters sca2
      on sca2.script_id = sca.script_id
     and sca2.character_id = case
           when cj.character_a_id = sca.character_id then cj.character_b_id
           else cj.character_a_id
         end
    where sca.script_id = p_script_id
  ),
  bootlegger as (
    select coalesce(
      (select array_length(s.bootlegger_rules, 1) from public.scripts s where s.id = p_script_id),
      0
    ) > 0 as has_bootlegger
  )
  select public.score_script_characters(
    (select coalesce(array_agg(name), array[]::text[]) from chars),
    (select coalesce(array_agg(team), array[]::text[]) from chars),
    (select coalesce(array_agg(coalesce(ability, '')), array[]::text[]) from chars),
    (select coalesce(array_agg(other_night::integer), array[]::integer[]) from chars),
    (select jinx_count::integer from jinx),
    (select has_bootlegger from bootlegger)
  );
$$;
