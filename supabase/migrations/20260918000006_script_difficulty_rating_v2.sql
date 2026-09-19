-- botchub — difficulty rating v2 (Diego's 8-category additive model)
--
-- Replaces v1's linear-weighted-sum-with-corpus-fit-thresholds (which needed
-- re-deriving as the script library grew) with a self-contained additive
-- model: base 1 star, plus up to 8 independently-capped category bonuses,
-- so the scale never needs recalibrating against the live corpus again.
--
-- Categories (each measured by counting matching characters on the script):
--   1. Poisoning/Drunk        2 ways -> +.25, 3+ -> +.5
--   2. Madness/Lunatic/Marionette   1-2 ways -> +.25, 3+ -> +.5
--   3. Alignment/Role swapping      2 ways -> +.25, 3+ -> +.5
--   4. Kill possibilities (non-Demon)  2 ways -> +.25, 3+ -> +.5
--   5. Ending-game possibilities    4 ways -> +.25, 5+ -> +.5
--   6. Each-night (recurring) abilities  5-6 ways -> +.25, 7+ -> +.5
--   7. Jinxes possible          3-4 ways -> +.25, 5+ -> +.5
--   8. Lore/Fables in play        1-2 ways -> +.25, 3+ -> +.5 (or +1.5
--      instead of +.5 if the script also has a Bootlegger rule)
--
-- Max: 1 + 7*.5 + 1.5 = 6.0, so the scale is now 1-6, not 1-5.
--
-- Categories 1, 2, 4, 5, 6 are new keyword/name-based heuristics drafted
-- against the official character list — same approach as v1's alignment
-- regex (a draft to sanity-check against real scripts, not a claim of
-- precision). Categories 3, 7, 8 keep their v1 definitions.
--
-- NOTE: this migration's own \b-based regexes for categories 2 and 5 turned
-- out to be broken (Postgres ARE regex uses \y for a word boundary, not \b
-- — \b is a literal backspace and matches nothing) — fixed by the very next
-- migration. Left as originally applied for an accurate history.

alter table public.scripts drop constraint scripts_difficulty_check;
alter table public.scripts
  add constraint scripts_difficulty_check
    check (difficulty is null or (difficulty >= 1 and difficulty <= 6));

comment on column public.scripts.difficulty is
  'Auto-computed 1-6 (quarter-star) difficulty estimate — see compute_script_difficulty(). Null for scripts uploaded before this existed, until re-saved.';

create or replace function public.compute_script_difficulty(p_script_id uuid)
returns numeric(2,1)
language sql
stable
set search_path = ''
as $function$
  with agg as (
    select
      count(*) filter (
        where c.ability ~* '(poison|drunk)'
      ) as poison_drunk_count,
      count(*) filter (
        where c.name in ('Lunatic', 'Marionette') or c.ability ~* '\bmad\b'
      ) as madness_count,
      count(*) filter (
        where c.team not in ('fabled', 'loric')
          and c.ability ~* '(thinks (that )?(he|she|they|you) (is|are)|register(s)?\s+as|you are actually|(gain|lose)s?\s+(a|this|their)\s+ability|(becomes?|become)\s+(the|a|an)\s+|is not the character|counts? as (good|evil|a demon|a minion|a townsfolk|an outsider)|swap|switch (their )?character|if.*(win|wins).*(good|evil)|you (might|may) (be|become))'
      ) as align_count,
      count(*) filter (
        where c.team <> 'demon' and c.ability ~* '(die|death)'
      ) as kill_count,
      count(*) filter (
        where c.ability ~* '\b(win|wins|lose|loses)\b'
      ) as ending_count,
      count(*) filter (
        where coalesce(c.other_night, 0) > 0
      ) as night_count,
      count(*) filter (where c.team in ('fabled', 'loric')) as fabled_loric_count
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
  select
    1.0
    + case when agg.poison_drunk_count >= 3 then 0.5 when agg.poison_drunk_count >= 2 then 0.25 else 0 end
    + case when agg.madness_count >= 3 then 0.5 when agg.madness_count >= 1 then 0.25 else 0 end
    + case when agg.align_count >= 3 then 0.5 when agg.align_count >= 2 then 0.25 else 0 end
    + case when agg.kill_count >= 3 then 0.5 when agg.kill_count >= 2 then 0.25 else 0 end
    + case when agg.ending_count >= 5 then 0.5 when agg.ending_count >= 4 then 0.25 else 0 end
    + case when agg.night_count >= 7 then 0.5 when agg.night_count >= 5 then 0.25 else 0 end
    + case when jinx.jinx_count >= 5 then 0.5 when jinx.jinx_count >= 3 then 0.25 else 0 end
    + case
        when agg.fabled_loric_count >= 3 and bootlegger.has_bootlegger then 1.5
        when agg.fabled_loric_count >= 3 then 0.5
        when agg.fabled_loric_count >= 1 then 0.25
        else 0
      end
  from agg, jinx, bootlegger;
$function$;

comment on function public.compute_script_difficulty(uuid) is
  'v2 heuristic difficulty score (1-6, quarter-star steps): base 1 + up to 8 independently-capped category bonuses. See scripts.difficulty column comment.';

update public.scripts set difficulty = public.compute_script_difficulty(id);
