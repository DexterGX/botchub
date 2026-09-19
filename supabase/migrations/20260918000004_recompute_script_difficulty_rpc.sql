create function public.recompute_script_difficulty(p_script_id uuid)
returns void
language sql
volatile
set search_path = ''
as $function$
  update public.scripts
  set difficulty = public.compute_script_difficulty(p_script_id)
  where id = p_script_id;
$function$;

comment on function public.recompute_script_difficulty(uuid) is
  'Recomputes and stores one script''s difficulty column — called from lib/script-upload-actions.ts right after script_characters is populated.';

grant execute on function public.recompute_script_difficulty(uuid) to authenticated;
