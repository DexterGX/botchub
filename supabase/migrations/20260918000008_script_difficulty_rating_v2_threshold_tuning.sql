-- Diego's tuning pass on the three categories that were saturating on
-- every full-size script (see prior migration's findings): raises
-- Poisoning/Drunk, Kills, and Each-night thresholds so they discriminate
-- among full scripts too, instead of maxing out on nearly all of them.
--   Poisoning/Drunk: 2/3 -> 4/6
--   Kills:            2/3 -> 4/6
--   Each-night:       5/7 -> 8/11
-- Madness, Alignment/Role swap, Ending-game, Jinxes, Lore/Fables unchanged.

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
        where c.name in ('Lunatic', 'Marionette') or c.ability ~* '\ymad\y'
      ) as madness_count,
      count(*) filter (
        where c.team not in ('fabled', 'loric')
          and c.ability ~* '(thinks (that )?(he|she|they|you) (is|are)|register(s)?\s+as|you are actually|(gain|lose)s?\s+(a|this|their)\s+ability|(becomes?|become)\s+(the|a|an)\s+|is not the character|counts? as (good|evil|a demon|a minion|a townsfolk|an outsider)|swap|switch (their )?character|if.*(win|wins).*(good|evil)|you (might|may) (be|become))'
      ) as align_count,
      count(*) filter (
        where c.team <> 'demon'
          and c.ability ~* '(die|death)'
          and c.ability !~* '(can.?t|cannot|don.?t|won.?t)\s*die'
      ) as kill_count,
      count(*) filter (
        where c.ability ~* '\y(win|wins|lose|loses)\y'
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
    + case when agg.poison_drunk_count >= 6 then 0.5 when agg.poison_drunk_count >= 4 then 0.25 else 0 end
    + case when agg.madness_count >= 3 then 0.5 when agg.madness_count >= 1 then 0.25 else 0 end
    + case when agg.align_count >= 3 then 0.5 when agg.align_count >= 2 then 0.25 else 0 end
    + case when agg.kill_count >= 6 then 0.5 when agg.kill_count >= 4 then 0.25 else 0 end
    + case when agg.ending_count >= 5 then 0.5 when agg.ending_count >= 4 then 0.25 else 0 end
    + case when agg.night_count >= 11 then 0.5 when agg.night_count >= 8 then 0.25 else 0 end
    + case when jinx.jinx_count >= 5 then 0.5 when jinx.jinx_count >= 3 then 0.25 else 0 end
    + case
        when agg.fabled_loric_count >= 3 and bootlegger.has_bootlegger then 1.5
        when agg.fabled_loric_count >= 3 then 0.5
        when agg.fabled_loric_count >= 1 then 0.25
        else 0
      end
  from agg, jinx, bootlegger;
$function$;

update public.scripts set difficulty = public.compute_script_difficulty(id);
