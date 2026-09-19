alter table public.scripts
  add column difficulty numeric(2,1)
    check (difficulty is null or (difficulty >= 1 and difficulty <= 5));

comment on column public.scripts.difficulty is
  'Auto-computed 1-5 (half-star) difficulty estimate — see compute_script_difficulty(). Null for scripts uploaded before this existed, until re-saved.';

create function public.compute_script_difficulty(p_script_id uuid)
returns numeric(2,1)
language sql
stable
set search_path = ''
as $function$
  with agg as (
    select
      count(*) as char_count,
      count(*) filter (where c.is_homebrew) as homebrew_count,
      count(*) filter (
        where coalesce(c.first_night, 0) > 0 or coalesce(c.other_night, 0) > 0
      ) as wake_count,
      count(*) filter (where c.team in ('fabled', 'loric')) as fabled_loric_count,
      count(*) filter (
        where c.team not in ('fabled', 'loric')
          and c.ability ~* '(thinks (that )?(he|she|they|you) (is|are)|register(s)?\s+as|you are actually|(gain|lose)s?\s+(a|this|their)\s+ability|(becomes?|become)\s+(the|a|an)\s+|is not the character|counts? as (good|evil|a demon|a minion|a townsfolk|an outsider)|swap|switch (their )?character|if.*(win|wins).*(good|evil)|you (might|may) (be|become))'
      ) as align_count
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
  raw as (
    select
      coalesce(agg.char_count, 0) * 1.0
      + coalesce(agg.homebrew_count, 0) * 1.5
      + coalesce(agg.wake_count, 0) * 0.6
      + coalesce(jinx.jinx_count, 0) * 1.3
      + coalesce(agg.fabled_loric_count, 0) * 1.0
      + coalesce(
          (select array_length(s.bootlegger_rules, 1) from public.scripts s where s.id = p_script_id),
          0
        ) * 2.0
      + coalesce(agg.align_count, 0) * 1.8
      as score
    from agg, jinx
  )
  select case
    when raw.score <= 27 then 1.0
    when raw.score <= 44 then 1.5
    when raw.score <= 45.5 then 2.0
    when raw.score <= 48 then 2.5
    when raw.score <= 49 then 3.0
    when raw.score <= 50 then 3.5
    when raw.score <= 55 then 4.0
    when raw.score <= 60 then 4.5
    else 5.0
  end
  from raw;
$function$;

comment on function public.compute_script_difficulty(uuid) is
  'v1 heuristic difficulty score (1-5, half-steps) for one script. See scripts.difficulty column comment for the caveats.';

grant execute on function public.compute_script_difficulty(uuid) to authenticated, anon;
