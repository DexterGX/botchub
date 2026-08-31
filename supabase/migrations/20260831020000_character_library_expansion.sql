-- botchub — expand the official character library + add token icons
-- (Phase 2 follow-up)
--
-- Phase 1 only seeded the 3 base editions' Townsfolk/Outsider/Minion/Demon
-- rosters (72 characters). It never seeded Travellers or the wider pool of
-- official "extra" characters (no fixed edition — used across countless
-- custom scripts, e.g. Pukka, Vortox's siblings, etc.) that community
-- script tools treat as part of the standard character library. Diego
-- flagged the character-include/exclude filters as incomplete, which is
-- this gap. Source: bra1n/townsquare's roles.json (MIT-licensed, the same
-- source cross-checked for Phase 1's ability text), verified directly
-- against the raw file (130 total entries) rather than trusted from a
-- summary — a first pass at this misattributed a few demons' editions
-- before the raw data was checked directly, so this was double-checked
-- character-by-character against the parsed JSON. No official "Fabled"
-- data was found in this source; that team stays empty until a verified
-- source turns up rather than guessing at entries.
--
-- Also fixes a latent bug in Phase 1's uniqueness constraint: the partial
-- unique index on characters.character_id was scoped `where edition is
-- not null`, which happened to line up with "official" while every
-- official character had an edition. That's no longer true now that
-- official Travellers/extras have edition = null — the correct scope was
-- always `where is_homebrew = false`.

drop index if exists public.characters_official_character_id_idx;

create unique index if not exists characters_official_character_id_idx
  on public.characters (character_id)
  where is_homebrew = false;

alter table public.characters add column if not exists icon_url text;

insert into public.characters (character_id, name, team, edition, ability, is_homebrew)
values
  ('bureaucrat', 'Bureaucrat', 'traveller', 'tb', 'Each night, choose a player (not yourself): their vote counts as 3 votes tomorrow.', false),
  ('thief', 'Thief', 'traveller', 'tb', 'Each night, choose a player (not yourself): their vote counts negatively tomorrow.', false),
  ('gunslinger', 'Gunslinger', 'traveller', 'tb', 'Each day, after the 1st vote has been tallied, you may choose a player that voted: they die.', false),
  ('scapegoat', 'Scapegoat', 'traveller', 'tb', 'If a player of your alignment is executed, you might be executed instead.', false),
  ('beggar', 'Beggar', 'traveller', 'tb', 'You must use a vote token to vote. Dead players may choose to give you theirs. If so, you learn their alignment. You are sober & healthy.', false),
  ('apprentice', 'Apprentice', 'traveller', 'bmr', 'On your 1st night, you gain a Townsfolk ability (if good), or a Minion ability (if evil).', false),
  ('matron', 'Matron', 'traveller', 'bmr', 'Each day, you may choose up to 3 sets of 2 players to swap seats. Players may not leave their seats to talk in private.', false),
  ('judge', 'Judge', 'traveller', 'bmr', 'Once per game, if another player nominated, you may choose to force the current execution to pass or fail.', false),
  ('bishop', 'Bishop', 'traveller', 'bmr', 'Only the Storyteller can nominate. At least 1 opposite player must be nominated each day.', false),
  ('voudon', 'Voudon', 'traveller', 'bmr', 'Only you and the dead can vote. They don''t need a vote token to do so. A 50% majority is not required.', false),
  ('barista', 'Barista', 'traveller', 'snv', 'Each night, until dusk, 1) a player becomes sober, healthy and gets true info, or 2) their ability works twice. They learn which.', false),
  ('harlot', 'Harlot', 'traveller', 'snv', 'Each night*, choose a living player: if they agree, you learn their character, but you both might die.', false),
  ('butcher', 'Butcher', 'traveller', 'snv', 'Each day, after the 1st execution, you may nominate again.', false),
  ('bonecollector', 'Bone Collector', 'traveller', 'snv', 'Once per game, at night, choose a dead player: they regain their ability until dusk.', false),
  ('deviant', 'Deviant', 'traveller', 'snv', 'If you were funny today, you cannot die by exile.', false),
  ('noble', 'Noble', 'townsfolk', null, 'You start knowing 3 players, 1 and only 1 of which is evil.', false),
  ('bountyhunter', 'Bounty Hunter', 'townsfolk', null, 'You start knowing 1 evil player. If the player you know dies, you learn another evil player tonight. [1 Townsfolk is evil]', false),
  ('pixie', 'Pixie', 'townsfolk', null, 'You start knowing 1 in-play Townsfolk. If you were mad that you were this character, you gain their ability when they die.', false),
  ('general', 'General', 'townsfolk', null, 'Each night, you learn which alignment the Storyteller believes is winning: good, evil, or neither.', false),
  ('preacher', 'Preacher', 'townsfolk', null, 'Each night, choose a player: a Minion, if chosen, learns this. All chosen Minions have no ability.', false),
  ('king', 'King', 'townsfolk', null, 'Each night, if the dead outnumber the living, you learn 1 alive character. The Demon knows who you are.', false),
  ('balloonist', 'Balloonist', 'townsfolk', null, 'Each night, you learn 1 player of each character type, until there are no more types to learn. [+1 Outsider]', false),
  ('cultleader', 'Cult Leader', 'townsfolk', null, 'Each night, you become the alignment of an alive neighbour. If all good players choose to join your cult, your team wins.', false),
  ('lycanthrope', 'Lycanthrope', 'townsfolk', null, 'Each night*, choose a living player: if good, they die, but they are the only player that can die tonight.', false),
  ('amnesiac', 'Amnesiac', 'townsfolk', null, 'You do not know what your ability is. Each day, privately guess what it is: you learn how accurate you are.', false),
  ('nightwatchman', 'Nightwatchman', 'townsfolk', null, 'Once per game, at night, choose a player: they learn who you are.', false),
  ('engineer', 'Engineer', 'townsfolk', null, 'Once per game, at night, choose which Minions or which Demon is in play.', false),
  ('fisherman', 'Fisherman', 'townsfolk', null, 'Once per game, during the day, visit the Storyteller for some advice to help you win.', false),
  ('huntsman', 'Huntsman', 'townsfolk', null, 'Once per game, at night, choose a living player: the Damsel, if chosen, becomes a not-in-play Townsfolk. [+the Damsel]', false),
  ('alchemist', 'Alchemist', 'townsfolk', null, 'You have a not-in-play Minion ability.', false),
  ('farmer', 'Farmer', 'townsfolk', null, 'If you die at night, an alive good player becomes a Farmer.', false),
  ('magician', 'Magician', 'townsfolk', null, 'The Demon thinks you are a Minion. Minions think you are a Demon.', false),
  ('choirboy', 'Choirboy', 'townsfolk', null, 'If the Demon kills the King, you learn which player is the Demon. [+ the King]', false),
  ('poppygrower', 'Poppy Grower', 'townsfolk', null, 'Minions & Demons do not know each other. If you die, they learn who each other are that night.', false),
  ('atheist', 'Atheist', 'townsfolk', null, 'The Storyteller can break the game rules & if executed, good wins, even if you are dead. [No evil characters]', false),
  ('cannibal', 'Cannibal', 'townsfolk', null, 'You have the ability of the recently killed executee. If they are evil, you are poisoned until a good player dies by execution.', false),
  ('snitch', 'Snitch', 'outsider', null, 'Minions start knowing 3 not-in-play characters.', false),
  ('acrobat', 'Acrobat', 'outsider', null, 'Each night*, if either good living neighbour is drunk or poisoned, you die.', false),
  ('puzzlemaster', 'Puzzlemaster', 'outsider', null, '1 player is drunk, even if you die. If you guess (once) who it is, learn the Demon player, but guess wrong & get false info.', false),
  ('heretic', 'Heretic', 'outsider', null, 'Whoever wins, loses & whoever loses, wins, even if you are dead.', false),
  ('damsel', 'Damsel', 'outsider', null, 'All Minions know you are in play. If a Minion publicly guesses you (once), your team loses.', false),
  ('golem', 'Golem', 'outsider', null, 'You may only nominate once per game. When you do, if the nominee is not the Demon, they die.', false),
  ('politician', 'Politician', 'outsider', null, 'If you were the player most responsible for your team losing, you change alignment & win, even if dead.', false),
  ('widow', 'Widow', 'minion', null, 'On your 1st night, look at the Grimoire and choose a player: they are poisoned. 1 good player knows a Widow is in play.', false),
  ('fearmonger', 'Fearmonger', 'minion', null, 'Each night, choose a player. If you nominate & execute them, their team loses. All players know if you choose a new player.', false),
  ('psychopath', 'Psychopath', 'minion', null, 'Each day, before nominations, you may publicly choose a player: they die. If executed, you only die if you lose roshambo.', false),
  ('goblin', 'Goblin', 'minion', null, 'If you publicly claim to be the Goblin when nominated & are executed that day, your team wins.', false),
  ('mephit', 'Mephit', 'minion', null, 'You start knowing a secret word. The 1st good player to say this word becomes evil that night.', false),
  ('mezepheles', 'Mezepheles', 'minion', null, 'You start knowing a secret word. The 1st good player to say this word becomes evil that night.', false),
  ('marionette', 'Marionette', 'minion', null, 'You think you are a good character but you are not. The Demon knows who you are. [You neighbour the Demon]', false),
  ('boomdandy', 'Boomdandy', 'minion', null, 'If you are executed, all but 3 players die. 1 minute later, the player with the most players pointing at them dies.', false),
  ('lilmonsta', 'Lil'' Monsta', 'demon', null, 'Each night, Minions choose who babysits Lil'' Monsta''s token & "is the Demon". A player dies each night*. [+1 Minion]', false),
  ('lleech', 'Lleech', 'demon', null, 'Each night*, choose a player: they die. You start by choosing an alive player: they are poisoned - you die if & only if they die.', false),
  ('alhadikhia', 'Al-Hadikhia', 'demon', null, 'Each night*, choose 3 players (all players learn who): each silently chooses to live or die, but if all live, all die.', false),
  ('legion', 'Legion', 'demon', null, 'Each night*, a player might die. Executions fail if only evil voted. You register as a Minion too. [Most players are Legion]', false),
  ('leviathan', 'Leviathan', 'demon', null, 'If more than 1 good player is executed, you win. All players know you are in play. After day 5, evil wins.', false),
  ('riot', 'Riot', 'demon', null, 'Nominees die, but may nominate again immediately (on day 3, they must). After day 3, evil wins. [All Minions are Riot]', false),
  ('gangster', 'Gangster', 'traveller', null, 'Once per day, you may choose to kill an alive neighbour, if your other alive neighbour agrees.', false)
on conflict (character_id) where is_homebrew = false do nothing;

-- Token icons: self-hosting would need Storage write access this session
-- doesn't have (no service-role key), so these point at the same
-- MIT-licensed townsquare asset set already used for ability text —
-- worth migrating to Supabase Storage once that access exists.
update public.characters
set icon_url = 'https://raw.githubusercontent.com/bra1n/townsquare/master/src/assets/icons/' || character_id || '.png'
where is_homebrew = false;
