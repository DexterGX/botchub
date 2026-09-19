-- Diego's ask: Storyteller should be "part of it" (counted) by default on a
-- new group, worth 3 points same as a Win, -2 if a Storyteller mistake was
-- noted (a real penalty, not a smaller bonus like before). Column defaults
-- kept in sync with lib/types.ts's DEFAULT_GROUP_POINTS_CONFIG, same as the
-- original groups_feature_schema migration did.
alter table public.groups
  alter column count_storyteller set default true,
  alter column storyteller_points set default 3,
  alter column storyteller_points_mistake set default -2;
