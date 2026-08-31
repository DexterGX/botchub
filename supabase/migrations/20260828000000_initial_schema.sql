-- botchub — initial schema (Phase 1)
-- Data model per architecture.md. JSON (script_json) is the source of truth for
-- scripts; PDFs are derived artifacts stored in the script-pdfs Storage bucket.
--
-- Auth note: profiles.id is a FK to auth.users, but the trigger that creates a
-- profiles row on signup is added in the Phase 3 migration, not here — Phase 1
-- has no auth yet, so owner_id / user_id columns below are nullable and seed
-- data is inserted with no owner.

create extension if not exists pgcrypto;

-- =========================================================================
-- profiles
-- =========================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles are publicly readable"
  on public.profiles for select
  using (true);

create policy "users can insert their own profile"
  on public.profiles for insert
  with check ((select auth.uid()) = id);

create policy "users can update their own profile"
  on public.profiles for update
  using ((select auth.uid()) = id);

-- =========================================================================
-- scripts
-- =========================================================================
create table if not exists public.scripts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles (id) on delete set null,
  name text not null,
  description text,
  script_json jsonb not null,
  edition text, -- 'tb' | 'bmr' | 'snv' for official base scripts, null for custom
  view_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists scripts_owner_id_idx on public.scripts (owner_id);
create index if not exists scripts_name_idx on public.scripts using gin (to_tsvector('english', name));

alter table public.scripts enable row level security;

create policy "scripts are publicly readable"
  on public.scripts for select
  using (true);

create policy "owners can insert their own scripts"
  on public.scripts for insert
  with check ((select auth.uid()) = owner_id);

create policy "owners can update their own scripts"
  on public.scripts for update
  using ((select auth.uid()) = owner_id);

create policy "owners can delete their own scripts"
  on public.scripts for delete
  using ((select auth.uid()) = owner_id);

-- =========================================================================
-- script_versions — version history, mirrors the "History" tab on botcscripts.com
-- =========================================================================
create table if not exists public.script_versions (
  id uuid primary key default gen_random_uuid(),
  script_id uuid not null references public.scripts (id) on delete cascade,
  version_number integer not null,
  script_json jsonb not null,
  pdf_path text, -- path within the script-pdfs bucket
  created_at timestamptz not null default now(),
  unique (script_id, version_number)
);

alter table public.script_versions enable row level security;

create policy "script versions are publicly readable"
  on public.script_versions for select
  using (true);

create policy "owners can insert versions of their own scripts"
  on public.script_versions for insert
  with check (
    exists (
      select 1 from public.scripts s
      where s.id = script_id and s.owner_id = (select auth.uid())
    )
  );

-- =========================================================================
-- characters — reference table: official characters (seeded) + homebrew
-- characters pulled out of custom scripts so they're searchable.
-- =========================================================================
create table if not exists public.characters (
  id uuid primary key default gen_random_uuid(),
  character_id text not null, -- the script-JSON id string, e.g. "washerwoman"
  name text not null,
  team text not null check (team in ('townsfolk', 'outsider', 'minion', 'demon', 'traveller', 'fabled', 'loric')),
  edition text, -- 'tb' | 'bmr' | 'snv' | null for homebrew
  ability text,
  is_homebrew boolean not null default false,
  source_script_id uuid references public.scripts (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Official characters (edition is set) must be unique per character_id;
-- homebrew characters (edition is null) may reuse a character_id across
-- different authors' scripts, so that uniqueness only applies to official rows.
create unique index if not exists characters_official_character_id_idx
  on public.characters (character_id)
  where edition is not null;

create index if not exists characters_character_id_idx on public.characters (character_id);
create index if not exists characters_team_idx on public.characters (team);

alter table public.characters enable row level security;

create policy "characters are publicly readable"
  on public.characters for select
  using (true);

-- Writes to `characters` happen server-side (seeding official data, or
-- extracting homebrew characters on script upload) using the service role,
-- which bypasses RLS — so no insert/update policy is defined for v1.

-- =========================================================================
-- script_characters — flattened join table for stats/search
-- =========================================================================
create table if not exists public.script_characters (
  id uuid primary key default gen_random_uuid(),
  script_id uuid not null references public.scripts (id) on delete cascade,
  character_id uuid not null references public.characters (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (script_id, character_id)
);

create index if not exists script_characters_script_id_idx on public.script_characters (script_id);
create index if not exists script_characters_character_id_idx on public.script_characters (character_id);

alter table public.script_characters enable row level security;

create policy "script_characters are publicly readable"
  on public.script_characters for select
  using (true);

-- =========================================================================
-- script_likes
-- =========================================================================
create table if not exists public.script_likes (
  script_id uuid not null references public.scripts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (script_id, user_id)
);

alter table public.script_likes enable row level security;

create policy "script likes are publicly readable"
  on public.script_likes for select
  using (true);

create policy "users can like scripts as themselves"
  on public.script_likes for insert
  with check ((select auth.uid()) = user_id);

create policy "users can unlike scripts as themselves"
  on public.script_likes for delete
  using ((select auth.uid()) = user_id);

-- =========================================================================
-- script_ratings
-- =========================================================================
create table if not exists public.script_ratings (
  script_id uuid not null references public.scripts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (script_id, user_id)
);

alter table public.script_ratings enable row level security;

create policy "script ratings are publicly readable"
  on public.script_ratings for select
  using (true);

create policy "users can rate as themselves"
  on public.script_ratings for insert
  with check ((select auth.uid()) = user_id);

create policy "users can update their own rating"
  on public.script_ratings for update
  using ((select auth.uid()) = user_id);

create policy "users can remove their own rating"
  on public.script_ratings for delete
  using ((select auth.uid()) = user_id);

-- =========================================================================
-- comments
-- =========================================================================
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  script_id uuid not null references public.scripts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists comments_script_id_idx on public.comments (script_id);

alter table public.comments enable row level security;

create policy "comments are publicly readable"
  on public.comments for select
  using (true);

create policy "users can comment as themselves"
  on public.comments for insert
  with check ((select auth.uid()) = user_id);

create policy "users can edit their own comments"
  on public.comments for update
  using ((select auth.uid()) = user_id);

create policy "users can delete their own comments"
  on public.comments for delete
  using ((select auth.uid()) = user_id);

-- =========================================================================
-- collections — user-curated groups of scripts
-- =========================================================================
create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  description text,
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.collections enable row level security;

create policy "public collections readable by everyone, private by owner"
  on public.collections for select
  using (is_public or owner_id = (select auth.uid()));

create policy "users can create their own collections"
  on public.collections for insert
  with check ((select auth.uid()) = owner_id);

create policy "owners can update their own collections"
  on public.collections for update
  using ((select auth.uid()) = owner_id);

create policy "owners can delete their own collections"
  on public.collections for delete
  using ((select auth.uid()) = owner_id);

-- =========================================================================
-- collection_scripts
-- =========================================================================
create table if not exists public.collection_scripts (
  collection_id uuid not null references public.collections (id) on delete cascade,
  script_id uuid not null references public.scripts (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (collection_id, script_id)
);

alter table public.collection_scripts enable row level security;

create policy "collection contents follow the collection's visibility"
  on public.collection_scripts for select
  using (
    exists (
      select 1 from public.collections c
      where c.id = collection_id and (c.is_public or c.owner_id = (select auth.uid()))
    )
  );

create policy "owners can add scripts to their own collections"
  on public.collection_scripts for insert
  with check (
    exists (
      select 1 from public.collections c
      where c.id = collection_id and c.owner_id = (select auth.uid())
    )
  );

create policy "owners can remove scripts from their own collections"
  on public.collection_scripts for delete
  using (
    exists (
      select 1 from public.collections c
      where c.id = collection_id and c.owner_id = (select auth.uid())
    )
  );

-- =========================================================================
-- tags / script_tags
-- =========================================================================
create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique
);

alter table public.tags enable row level security;

create policy "tags are publicly readable"
  on public.tags for select
  using (true);

create policy "authenticated users can propose new tags"
  on public.tags for insert
  to authenticated
  with check (true);

create table if not exists public.script_tags (
  script_id uuid not null references public.scripts (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (script_id, tag_id)
);

alter table public.script_tags enable row level security;

create policy "script_tags are publicly readable"
  on public.script_tags for select
  using (true);

create policy "owners can tag their own scripts"
  on public.script_tags for insert
  with check (
    exists (
      select 1 from public.scripts s
      where s.id = script_id and s.owner_id = (select auth.uid())
    )
  );

create policy "owners can untag their own scripts"
  on public.script_tags for delete
  using (
    exists (
      select 1 from public.scripts s
      where s.id = script_id and s.owner_id = (select auth.uid())
    )
  );

-- =========================================================================
-- groups / group_members — private leaderboard groups (Phase 9)
-- =========================================================================
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  invite_code text not null unique default substr(md5(random()::text), 1, 8),
  created_at timestamptz not null default now()
);

alter table public.groups enable row level security;

create table if not exists public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

alter table public.group_members enable row level security;

create policy "members and the owner can see a group"
  on public.groups for select
  using (
    owner_id = (select auth.uid())
    or exists (
      select 1 from public.group_members gm
      where gm.group_id = id and gm.user_id = (select auth.uid())
    )
  );

create policy "users can create groups they own"
  on public.groups for insert
  with check ((select auth.uid()) = owner_id);

create policy "owners can update their own groups"
  on public.groups for update
  using ((select auth.uid()) = owner_id);

create policy "owners can delete their own groups"
  on public.groups for delete
  using ((select auth.uid()) = owner_id);

create policy "members can see the membership list of their own groups"
  on public.group_members for select
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.groups g
      where g.id = group_id and g.owner_id = (select auth.uid())
    )
  );

create policy "users can join a group as themselves"
  on public.group_members for insert
  with check ((select auth.uid()) = user_id);

create policy "members can leave, owners can remove members"
  on public.group_members for delete
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.groups g
      where g.id = group_id and g.owner_id = (select auth.uid())
    )
  );

-- =========================================================================
-- games / game_players (Phase 7-8)
-- =========================================================================
create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups (id) on delete set null,
  script_id uuid references public.scripts (id) on delete set null,
  played_at timestamptz not null default now(),
  winning_team text check (winning_team in ('good', 'evil')),
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.games enable row level security;

create policy "games are readable when ungrouped or by group members"
  on public.games for select
  using (
    group_id is null
    or exists (
      select 1 from public.group_members gm
      where gm.group_id = games.group_id and gm.user_id = (select auth.uid())
    )
    or exists (
      select 1 from public.groups g
      where g.id = games.group_id and g.owner_id = (select auth.uid())
    )
  );

create policy "group members can record games"
  on public.games for insert
  with check (
    (select auth.uid()) = created_by
    and (
      group_id is null
      or exists (
        select 1 from public.group_members gm
        where gm.group_id = games.group_id and gm.user_id = (select auth.uid())
      )
    )
  );

create policy "the creator or group owner can edit a game"
  on public.games for update
  using (
    created_by = (select auth.uid())
    or exists (
      select 1 from public.groups g
      where g.id = games.group_id and g.owner_id = (select auth.uid())
    )
  );

create policy "the creator or group owner can delete a game"
  on public.games for delete
  using (
    created_by = (select auth.uid())
    or exists (
      select 1 from public.groups g
      where g.id = games.group_id and g.owner_id = (select auth.uid())
    )
  );

create table if not exists public.game_players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  display_name text, -- for guest players without a botchub account
  character_id uuid references public.characters (id) on delete set null,
  team text check (team in ('good', 'evil')),
  won boolean,
  created_at timestamptz not null default now()
);

create index if not exists game_players_game_id_idx on public.game_players (game_id);
create index if not exists game_players_user_id_idx on public.game_players (user_id);

alter table public.game_players enable row level security;

create policy "game_players follow the parent game's visibility"
  on public.game_players for select
  using (
    exists (
      select 1 from public.games g
      where g.id = game_id
        and (
          g.group_id is null
          or exists (
            select 1 from public.group_members gm
            where gm.group_id = g.group_id and gm.user_id = (select auth.uid())
          )
          or exists (
            select 1 from public.groups gr
            where gr.id = g.group_id and gr.owner_id = (select auth.uid())
          )
        )
    )
  );

create policy "the game's creator or group owner manages its players"
  on public.game_players for insert
  with check (
    exists (
      select 1 from public.games g
      where g.id = game_id
        and (
          g.created_by = (select auth.uid())
          or exists (
            select 1 from public.groups gr
            where gr.id = g.group_id and gr.owner_id = (select auth.uid())
          )
        )
    )
  );

create policy "the game's creator or group owner updates its players"
  on public.game_players for update
  using (
    exists (
      select 1 from public.games g
      where g.id = game_id
        and (
          g.created_by = (select auth.uid())
          or exists (
            select 1 from public.groups gr
            where gr.id = g.group_id and gr.owner_id = (select auth.uid())
          )
        )
    )
  );

create policy "the game's creator or group owner deletes its players"
  on public.game_players for delete
  using (
    exists (
      select 1 from public.games g
      where g.id = game_id
        and (
          g.created_by = (select auth.uid())
          or exists (
            select 1 from public.groups gr
            where gr.id = g.group_id and gr.owner_id = (select auth.uid())
          )
        )
    )
  );

-- =========================================================================
-- group_leaderboards — computed view, not a stored table (Phase 9)
-- =========================================================================
create or replace view public.group_leaderboards as
select
  g.group_id,
  gp.user_id,
  count(*) as games_played,
  count(*) filter (where gp.won) as games_won,
  round(
    100.0 * count(*) filter (where gp.won) / nullif(count(*), 0), 1
  ) as win_rate_pct
from public.game_players gp
join public.games g on g.id = gp.game_id
where g.group_id is not null and gp.user_id is not null
group by g.group_id, gp.user_id;

-- security_invoker: without this, the view runs with its creator's
-- privileges (bypassing the querying user's RLS) rather than the querying
-- user's — flagged by Supabase's security advisor after the first apply.
alter view public.group_leaderboards set (security_invoker = true);

-- =========================================================================
-- updated_at helper trigger, applied to tables that track it
-- =========================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger scripts_set_updated_at
  before update on public.scripts
  for each row execute function public.set_updated_at();

create trigger script_ratings_set_updated_at
  before update on public.script_ratings
  for each row execute function public.set_updated_at();

create trigger comments_set_updated_at
  before update on public.comments
  for each row execute function public.set_updated_at();

-- =========================================================================
-- Covering indexes for foreign keys not already indexed above (flagged by
-- Supabase's performance advisor after the first apply — cheap to add now
-- while tables are empty rather than backfill under load later).
-- =========================================================================
create index if not exists characters_source_script_id_idx on public.characters (source_script_id);
create index if not exists collection_scripts_script_id_idx on public.collection_scripts (script_id);
create index if not exists collections_owner_id_idx on public.collections (owner_id);
create index if not exists comments_user_id_idx on public.comments (user_id);
create index if not exists game_players_character_id_idx on public.game_players (character_id);
create index if not exists games_created_by_idx on public.games (created_by);
create index if not exists games_group_id_idx on public.games (group_id);
create index if not exists games_script_id_idx on public.games (script_id);
create index if not exists group_members_user_id_idx on public.group_members (user_id);
create index if not exists groups_owner_id_idx on public.groups (owner_id);
create index if not exists script_likes_user_id_idx on public.script_likes (user_id);
create index if not exists script_ratings_user_id_idx on public.script_ratings (user_id);
create index if not exists script_tags_tag_id_idx on public.script_tags (tag_id);

-- =========================================================================
-- Storage buckets (script-pdfs, script-art, avatars) — per architecture.md
-- =========================================================================
insert into storage.buckets (id, name, public)
values
  ('script-pdfs', 'script-pdfs', true),
  ('script-art', 'script-art', true),
  ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "public read of script pdfs"
  on storage.objects for select
  using (bucket_id = 'script-pdfs');

create policy "public read of script art"
  on storage.objects for select
  using (bucket_id = 'script-art');

create policy "public read of avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- Path convention for script-pdfs / script-art: {script_id}/{filename} —
-- only the script's owner may write to its folder.
create policy "script owners can upload their script's pdf"
  on storage.objects for insert
  with check (
    bucket_id = 'script-pdfs'
    and exists (
      select 1 from public.scripts s
      where s.id::text = (storage.foldername(name))[1] and s.owner_id = (select auth.uid())
    )
  );

create policy "script owners can upload their script's art"
  on storage.objects for insert
  with check (
    bucket_id = 'script-art'
    and exists (
      select 1 from public.scripts s
      where s.id::text = (storage.foldername(name))[1] and s.owner_id = (select auth.uid())
    )
  );

-- Path convention for avatars: {user_id}/{filename} — only that user may write there.
create policy "users can upload their own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "users can replace their own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
