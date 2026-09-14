-- botchub — official character jinxes
--
-- Diego reported that uploaded script JSON doesn't carry the jinx rules the
-- official Script Tool shows in its "Djinn" special-rule box (e.g. for his
-- "Babciu, czemu masz takie wielkie zęby?" script: Alchemist+Boffin,
-- Boffin+Village Idiot, Philosopher+Bounty Hunter, Psychopath+Lil' Monsta,
-- Lil' Monsta+Scarlet Woman, Slayer+Lleech, Recluse+Sage). Confirmed: his
-- own JSON export uses bare `{"id": "..."}` references for every official
-- character, which per the official script-schema.json never carry inline
-- jinx data (that field is only present on a FULL inline character object,
-- essentially never used for official characters) — so there was nothing
-- for this app to parse out of any upload. Jinxes are game-wide knowledge
-- tied to a character PAIR, not something that travels in a script export;
-- the official site has its own internal jinx database to compute them.
-- botchub needs the same.
--
-- Data source: wiki.bloodontheclocktower.com's own Djinn page, which lists
-- every official jinx pairing organized by team (Townsfolk/Outsider/
-- Minion/Demon) — 131 pairs total across the four sections, extracted and
-- cross-checked against Diego's own screenshot of the official Script
-- Tool's rendered output for his exact script: all 7 jinx lines shown
-- there (Alchemist/Boffin, Boffin/Village Idiot, Philosopher/Bounty
-- Hunter, Psychopath/Lil' Monsta, Lil' Monsta/Scarlet Woman, Slayer/
-- Lleech, Recluse/Sage) matched this dataset character-for-character, so
-- it's trustworthy, not just plausible. (A third-party dataset —
-- chizmw/json-on-the-clocktower — was checked first and rejected: it only
-- has 30 characters' worth of jinxes and is missing the majority of real
-- ones, including most of the 7 in Diego's own test case — an incomplete
-- dataset here is actively worse than none, since it would silently claim
-- "no jinxes" for scripts that have them.)
--
-- Unordered pairs: stored as one row per pair with an order-independent
-- unique index (least/greatest of the two character ids), so a lookup for
-- "does A jinx B" only has to check both directions at read time, not at
-- insert time.

create table if not exists public.character_jinxes (
  id uuid primary key default gen_random_uuid(),
  character_a_id uuid not null references public.characters (id) on delete cascade,
  character_b_id uuid not null references public.characters (id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now(),
  constraint character_jinxes_distinct check (character_a_id <> character_b_id)
);

create unique index if not exists character_jinxes_pair_idx
  on public.character_jinxes (
    least(character_a_id, character_b_id),
    greatest(character_a_id, character_b_id)
  );

alter table public.character_jinxes enable row level security;

create policy "character_jinxes are publicly readable"
  on public.character_jinxes for select
  using (true);

-- Seed: (character_id slug, character_id slug, reason) resolved against
-- the official (is_homebrew = false) character library.
with pairs (a_slug, b_slug, reason) as (
  values
  ('alchemist', 'boffin', 'If the Alchemist has the Boffin ability, the Alchemist does not learn what ability the Demon has.'),
  ('alchemist', 'marionette', 'An Alchemist-Marionette has no Marionette ability & the Marionette is in play.'),
  ('alchemist', 'mastermind', 'An Alchemist-Mastermind has no Mastermind ability & the Mastermind is not-in-play.'),
  ('alchemist', 'organgrinder', 'If the Alchemist has the Organ Grinder ability, the Organ Grinder is in play. If both are sober, both are drunk.'),
  ('alchemist', 'spy', 'An Alchemist-Spy has no Spy ability & a Spy is in play. After each execution, a living Alchemist-Spy may publicly guess a living player as the Spy. If correct, the Demon must choose the Spy tonight.'),
  ('alchemist', 'summoner', 'The Alchemist-Summoner does not get bluffs, and chooses which Demon but not which player. If they die before this happens, evil wins. [No Demon]'),
  ('alchemist', 'wraith', 'An Alchemist-Wraith has no Wraith ability & a Wraith is in play. After each execution, a living Alchemist-Wraith may publicly guess a living player as the Wraith. If correct, the Demon must choose the Wraith tonight.'),
  ('alchemist', 'widow', 'An Alchemist-Widow has no Widow ability & a Widow is in play. After each execution, a living Alchemist-Widow may publicly guess a living player as the Widow. If correct, the Demon must choose the Widow tonight.'),
  ('bountyhunter', 'kazali', 'If the Kazali turns the Bounty Hunter into a Minion, an evil Townsfolk is not created.'),
  ('bountyhunter', 'philosopher', 'If the Philosopher gains the Bounty Hunter ability, a Townsfolk might turn evil.'),
  ('cannibal', 'butler', 'If the Cannibal gains the Butler ability, the Cannibal learns this.'),
  ('cannibal', 'juggler', 'If the Juggler guesses on their first day and dies by execution, tonight the living Cannibal learns how many guesses the Juggler got correct.'),
  ('cannibal', 'princess', 'If the Cannibal nominated, executed, & killed the Princess today, the Demon doesn''t kill tonight.'),
  ('cannibal', 'zealot', 'If the Cannibal gains the Zealot ability, the Cannibal learns this.'),
  ('mathematician', 'chambermaid', 'The Chambermaid can detect if the Mathematician will wake tonight.'),
  ('mathematician', 'drunk', 'The Mathematician learns if the Drunk''s ability yielded false info or failed to work properly.'),
  ('mathematician', 'lunatic', 'The Mathematician learns if the Lunatic attacks a different player than the real Demon attacked.'),
  ('mathematician', 'marionette', 'The Mathematician learns if the Marionette''s ability yielded false info or failed to work properly.'),
  ('magician', 'legion', 'If the Magician is in play, during the Demon info step, Legion wake in separate groups. Each group learns which players are good, but does not learn the Magician.'),
  ('magician', 'marionette', 'If the Magician is alive, the Demon doesn''t know which neighbor is the Marionette.'),
  ('magician', 'spy', 'When the Spy sees the Grimoire, the Demon and Magician''s character tokens are removed.'),
  ('magician', 'vizier', 'If the Vizier is in play, the Magician has no ability but is immune to the Vizier''s ability.'),
  ('magician', 'widow', 'When the Widow sees the Grimoire, the Demon and Magician''s character tokens are removed.'),
  ('magician', 'wraith', 'After each execution, the living Magician may publicly guess a living player as the Wraith. If correct, the Demon must choose the Wraith tonight.'),
  ('butler', 'organgrinder', 'If the Organ Grinder is causing eyes closed voting, the Butler may raise their hand to vote but their vote is only counted if their master voted too.'),
  ('heretic', 'baron', 'Only 1 jinxed character can be in play.'),
  ('heretic', 'godfather', 'Only 1 jinxed character can be in play.'),
  ('heretic', 'lleech', 'Only 1 jinxed character can be in play.'),
  ('heretic', 'pithag', 'Only 1 jinxed character can be in play.'),
  ('heretic', 'spy', 'Only 1 jinxed character can be in play.'),
  ('heretic', 'widow', 'Only 1 jinxed character can be in play.'),
  ('plaguedoctor', 'baron', 'If the Storyteller would gain the Baron ability, up to two players become Outsiders.'),
  ('plaguedoctor', 'boomdandy', 'If the Storyteller would gain the Boomdandy ability, a player becomes the Boomdandy.'),
  ('plaguedoctor', 'eviltwin', 'If the Storyteller would gain the Evil Twin ability, a player becomes the Evil Twin.'),
  ('plaguedoctor', 'fearmonger', 'If the Storyteller would gain the Fearmonger ability, a Minion gains it, and learns this.'),
  ('plaguedoctor', 'goblin', 'If the Storyteller would gain the Goblin ability, a Minion gains it, and learns this.'),
  ('plaguedoctor', 'marionette', 'If the Storyteller would gain the Marionette ability, one of the Demon''s good neighbors becomes the Marionette.'),
  ('plaguedoctor', 'scarletwoman', 'If the Storyteller would gain the Scarlet Woman ability, a Minion gains it, and learns this.'),
  ('plaguedoctor', 'spy', 'If the Storyteller would gain the Spy ability, a Minion gains it, and learns this.'),
  ('plaguedoctor', 'wraith', 'If the Storyteller would gain the Wraith ability, a Minion gains it, and learns this.'),
  ('recluse', 'ogre', 'If the Recluse registers as evil to the Ogre, the Ogre learns that they are evil.'),
  ('recluse', 'sage', 'The Recluse might register as the Demon to the Sage.'),
  ('boffin', 'cultleader', 'If the Demon has the Cult Leader ability, they can''t turn good due to this ability.'),
  ('boffin', 'drunk', 'The Demon cannot have the Drunk ability.'),
  ('boffin', 'goon', 'If the Demon has the Goon ability, they can''t turn good due to this ability.'),
  ('boffin', 'heretic', 'The Demon cannot have the Heretic ability.'),
  ('boffin', 'ogre', 'The Demon cannot have the Ogre ability.'),
  ('boffin', 'politician', 'The Demon cannot have the Politician ability.'),
  ('boffin', 'villageidiot', 'If there is a spare token, the Boffin can give the Demon the Village Idiot ability.'),
  ('cerenovus', 'goblin', 'The Cerenovus may choose to make a player mad that they are the Goblin.'),
  ('marionette', 'balloonist', 'If the Marionette thinks that they are the Balloonist, an Outsider might have been added.'),
  ('marionette', 'huntsman', 'If the Marionette thinks that they are the Huntsman, the Damsel was added during setup.'),
  ('marionette', 'kazali', 'If there would be a Marionette in play, they enter play after the Demon & must start as their neighbor.'),
  ('marionette', 'lilmonsta', 'If there would be a Marionette in play, they enter play after the Demon & must start as their neighbor.'),
  ('marionette', 'summoner', 'If there would be a Marionette in play, they enter play after the Demon & must start as their neighbor.'),
  ('mastermind', 'vigormortis', 'A Mastermind that has their ability keeps it if the Vigormortis dies.'),
  ('pithag', 'cultleader', 'If the Pit-Hag turns an evil player into the Cult Leader, they can''t turn good due to their own ability.'),
  ('pithag', 'damsel', 'If a Pit-Hag creates a Damsel, the Storyteller chooses which player it is.'),
  ('pithag', 'goon', 'If the Pit-Hag turns an evil player into the Goon, they can''t turn good due to their own ability.'),
  ('pithag', 'ogre', 'If the Pit-Hag turns an evil player into the Ogre, they can''t turn good due to their own ability.'),
  ('pithag', 'politician', 'If the Pit-Hag turns an evil player into the Politician, they can''t turn good due to their own ability.'),
  ('pithag', 'villageidiot', 'If there is a spare token, the Pit-Hag can create an extra Village Idiot. If so, the drunk Village Idiot might change.'),
  ('scarletwoman', 'alhadikhia', 'If there would be two Demons, one of which was the Scarlet Woman, the Scarlet Woman becomes the Scarlet Woman again.'),
  ('scarletwoman', 'fanggu', 'If there would be two Demons, one of which was the Scarlet Woman, the Scarlet Woman remains the Scarlet Woman.'),
  ('spy', 'damsel', 'If the Spy is (or has been) in play, the Damsel is poisoned.'),
  ('spy', 'ogre', 'The Spy registers as evil to the Ogre.'),
  ('spy', 'poppygrower', 'If the Poppy Grower has their ability, the Spy does not see the Grimoire.'),
  ('summoner', 'clockmaker', 'The Summoner registers as the Demon to the Clockmaker.'),
  ('summoner', 'courtier', 'If the living Summoner has no ability, the Storyteller has the Summoner ability.'),
  ('summoner', 'engineer', 'If the living Summoner is removed from play, the Storyteller has the Summoner ability.'),
  ('summoner', 'hatter', 'If the Summoner creates a second living Demon, deaths tonight are arbitrary.'),
  ('summoner', 'kazali', 'If the Summoner creates a second living Demon, deaths tonight are arbitrary.'),
  ('summoner', 'lordoftyphon', 'If a Lord of Typhon is summoned, they must neighbor a Minion & their other neighbor becomes an evil Minion.'),
  ('summoner', 'pithag', 'If the Summoner creates a second living Demon, deaths tonight are arbitrary.'),
  ('summoner', 'poppygrower', 'If the Poppy Grower is alive on the 3rd night, the Summoner chooses which Demon but not which player.'),
  ('summoner', 'preacher', 'If the living Summoner has no ability, the Storyteller has the Summoner ability.'),
  ('summoner', 'pukka', 'The Summoner may summon a Pukka on the 2nd night instead of the 3rd.'),
  ('summoner', 'zombuul', 'If the Summoner summons a dead player into the Zombuul, the Zombuul has already ''died once''.'),
  ('vizier', 'alsaahir', 'The Storyteller doesn''t declare the Vizier is in play.'),
  ('vizier', 'courtier', 'If the Vizier loses their ability, they learn this, and cannot die during the day.'),
  ('vizier', 'fearmonger', 'The Vizier wakes with the Fearmonger, learns who they choose and cannot choose to immediately execute that player.'),
  ('vizier', 'investigator', 'The Storyteller doesn''t declare the Vizier is in play.'),
  ('vizier', 'politician', 'The Politician might register as evil to the Vizier.'),
  ('vizier', 'preacher', 'If the Vizier loses their ability, they learn this, and cannot die during the day.'),
  ('vizier', 'zealot', 'The Zealot might register as evil to the Vizier.'),
  ('widow', 'damsel', 'If the Widow is (or has been) in play, the Damsel is poisoned.'),
  ('widow', 'poppygrower', 'If the Poppy Grower has their ability, the Widow does not see the Grimoire.'),
  ('alhadikhia', 'princess', 'If the Princess nominated & executed a player on their 1st day, no one dies to the Al-Hadikhia tonight.'),
  ('alhadikhia', 'mastermind', 'If the Al-Hadikhia dies by execution, and the Mastermind is alive, the Al-Hadikhia chooses 3 good players tonight: if all 3 choose to live, evil wins. Otherwise, good wins.'),
  ('legion', 'engineer', 'If Legion is created, all evil players become Legion. If Legion is in play, the Engineer starts knowing this but has no ability.'),
  ('legion', 'hatter', 'If Legion is created, all evil players become Legion. If Legion is in play, the Hatter has no ability.'),
  ('legion', 'minstrel', 'If Legion died by execution today, Legion keeps their ability, but the Minstrel might learn they are Legion.'),
  ('legion', 'politician', 'The Politician might register as evil to Legion.'),
  ('legion', 'preacher', 'If the Preacher chooses Legion, Legion keeps their ability, but the Preacher might learn they are Legion.'),
  ('legion', 'summoner', 'If Legion is summoned, all evil players become Legion.'),
  ('legion', 'zealot', 'The Zealot might register as evil to Legion.'),
  ('leviathan', 'banshee', 'Each night*, the Leviathan chooses an alive good player (different to previous nights): a chosen Banshee dies & gains their ability.'),
  ('leviathan', 'exorcist', 'If the Leviathan nominates and executes the Exorcist-chosen player, good wins.'),
  ('leviathan', 'farmer', 'Each night*, the Leviathan chooses an alive good player (different to previous nights): a chosen Farmer uses their ability but does not die.'),
  ('leviathan', 'grandmother', 'If the Leviathan is in play and the Grandchild dies by execution, evil wins.'),
  ('leviathan', 'hatter', 'The Leviathan cannot enter play after day 5.'),
  ('leviathan', 'innkeeper', 'If the Leviathan nominates and executes an Innkeeper-protected player, good wins.'),
  ('leviathan', 'king', 'If the Leviathan is in play, and at least 1 player is dead, the King learns an alive character each night.'),
  ('leviathan', 'mayor', 'If the Leviathan and the Mayor are alive on day 5 & no execution occurs, good wins.'),
  ('leviathan', 'monk', 'If the Leviathan nominates and executes the Monk-protected player, good wins.'),
  ('leviathan', 'pithag', 'The Leviathan cannot enter play after day 5.'),
  ('leviathan', 'ravenkeeper', 'Each night*, the Leviathan chooses an alive player (different to previous nights): a chosen Ravenkeeper uses their ability but does not die.'),
  ('leviathan', 'sage', 'Each night*, the Leviathan chooses an alive good player (different to previous nights): a chosen Sage uses their ability but does not die.'),
  ('leviathan', 'soldier', 'If the Leviathan nominates and executes the Soldier, good wins.'),
  ('lilmonsta', 'hatter', 'If the Hatter dies & the Demon chooses Lil'' Monsta, they also choose a Minion to become.'),
  ('lilmonsta', 'poppygrower', 'If Lil'' Monsta & the Poppy Grower are alive, Minions wake one by one, until one of them chooses to take the Lil'' Monsta token.'),
  ('lilmonsta', 'psychopath', 'If the Psychopath is babysitting Lil'' Monsta, they die when executed.'),
  ('lilmonsta', 'magician', 'If the Magician is alive, the Storyteller chooses which Minion babysits Lil'' Monsta.'),
  ('lilmonsta', 'scarletwoman', 'If Lil'' Monsta dies with 5 or more players alive, the Scarlet Woman babysits Lil'' Monsta for the rest of the game.'),
  ('lilmonsta', 'vizier', 'If the Vizier is babysitting Lil'' Monsta, they die when executed.'),
  ('lleech', 'mastermind', 'If the Mastermind is alive and the Lleech host dies by execution, the Lleech lives but loses their ability.'),
  ('lleech', 'slayer', 'If the Slayer slays the Lleech host, the host dies.'),
  ('riot', 'atheist', 'During a riot, if the Storyteller is nominated, players vote. If they are ''about to die'', the game ends. If not, they nominate again.'),
  ('riot', 'banshee', 'Each night*, Riot chooses an alive good player (different to previous nights): a chosen Banshee dies & gains their ability.'),
  ('riot', 'exorcist', 'If Riot nominates and executes the Exorcist-chosen player, good wins.'),
  ('riot', 'farmer', 'Each night*, Riot chooses an alive good player (different to previous nights): a chosen Farmer uses their ability but does not die.'),
  ('riot', 'grandmother', 'If Riot is in play and the Grandchild dies by execution, evil wins.'),
  ('riot', 'innkeeper', 'If Riot nominates and executes an Innkeeper-protected player, good wins.'),
  ('riot', 'king', 'If Riot is in play, and at least 1 player is dead, the King learns an alive character each night.'),
  ('riot', 'mayor', 'The Mayor may choose to stop the riot. If they do so when only 1 Riot is alive, good wins. Otherwise, evil wins.'),
  ('riot', 'monk', 'If Riot nominates and executes the Monk-protected player, good wins.'),
  ('riot', 'ravenkeeper', 'Each night*, Riot chooses an alive good player (different to previous nights): a chosen Ravenkeeper uses their ability but does not die.'),
  ('riot', 'sage', 'Each night*, Riot chooses an alive good player (different to previous nights): a chosen Sage uses their ability but does not die.'),
  ('riot', 'soldier', 'If Riot nominates and executes the Soldier, good wins.'),
  ('vortox', 'banshee', 'If the Vortox kills the Banshee, all players learn that the Banshee has died.'),
  ('yaggababble', 'exorcist', 'If the Exorcist chooses the Yaggababble, the Yaggababble does not kill tonight.')
)
insert into public.character_jinxes (character_a_id, character_b_id, reason)
select ca.id, cb.id, p.reason
from pairs p
join public.characters ca on ca.character_id = p.a_slug and ca.is_homebrew = false
join public.characters cb on cb.character_id = p.b_slug and cb.is_homebrew = false
on conflict do nothing;
