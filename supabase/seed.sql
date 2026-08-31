-- botchub — Phase 1 seed data
--
-- Sources for official character data: the official script-schema.json
-- (github.com/ThePandemoniumInstitute/botc-release) for the JSON shape and
-- id conventions, cross-checked against bra1n/townsquare's roles.json
-- (github.com/bra1n/townsquare) for the full team/ability text per edition.
--
-- IMPORTANT: the two scripts marked "botchub example script" below (The
-- Golden Hour, Fogbound Isle) are placeholder content invented for Phase 1
-- so Phase 2's UI has real rows to render — they are NOT real published
-- community scripts. Swap them for real ones (or delete them) before launch.

-- =========================================================================
-- Official characters — Trouble Brewing (tb)
-- =========================================================================
insert into public.characters (character_id, name, team, edition, ability, is_homebrew) values
  ('washerwoman', 'Washerwoman', 'townsfolk', 'tb', 'You start knowing that 1 of 2 players is a particular Townsfolk.', false),
  ('librarian', 'Librarian', 'townsfolk', 'tb', 'You start knowing that 1 of 2 players is a particular Outsider. (Or that zero are in play.)', false),
  ('investigator', 'Investigator', 'townsfolk', 'tb', 'You start knowing that 1 of 2 players is a particular Minion.', false),
  ('chef', 'Chef', 'townsfolk', 'tb', 'You start knowing how many pairs of evil players there are.', false),
  ('empath', 'Empath', 'townsfolk', 'tb', 'Each night, you learn how many of your 2 alive neighbours are evil.', false),
  ('fortuneteller', 'Fortune Teller', 'townsfolk', 'tb', 'Each night, choose 2 players: you learn if either is a Demon. There is a good player that registers as a Demon to you.', false),
  ('undertaker', 'Undertaker', 'townsfolk', 'tb', 'Each night*, you learn which character died by execution today.', false),
  ('monk', 'Monk', 'townsfolk', 'tb', 'Each night*, choose a player (not yourself): they are safe from the Demon tonight.', false),
  ('ravenkeeper', 'Ravenkeeper', 'townsfolk', 'tb', 'If you die at night, you are woken to choose a player: you learn their character.', false),
  ('virgin', 'Virgin', 'townsfolk', 'tb', 'The 1st time you are nominated, if the nominator is a Townsfolk, they are executed immediately.', false),
  ('slayer', 'Slayer', 'townsfolk', 'tb', 'Once per game, during the day, publicly choose a player: if they are the Demon, they die.', false),
  ('soldier', 'Soldier', 'townsfolk', 'tb', 'You are safe from the Demon.', false),
  ('mayor', 'Mayor', 'townsfolk', 'tb', 'If only 3 players live & no execution occurs, your team wins. If you die at night, another player might die instead.', false),
  ('butler', 'Butler', 'outsider', 'tb', 'Each night, choose a player (not yourself): tomorrow, you may only vote if they are voting too.', false),
  ('drunk', 'Drunk', 'outsider', 'tb', 'You do not know you are the Drunk. You think you are a Townsfolk character, but you are not.', false),
  ('recluse', 'Recluse', 'outsider', 'tb', 'You might register as evil & as a Minion or Demon, even if dead.', false),
  ('saint', 'Saint', 'outsider', 'tb', 'If you die by execution, your team loses.', false),
  ('poisoner', 'Poisoner', 'minion', 'tb', 'Each night, choose a player: they are poisoned tonight and tomorrow day.', false),
  ('spy', 'Spy', 'minion', 'tb', 'Each night, you see the Grimoire. You might register as good & as a Townsfolk or Outsider, even if dead.', false),
  ('scarletwoman', 'Scarlet Woman', 'minion', 'tb', 'If there are 5 or more players alive & the Demon dies, you become the Demon. (Travellers don''t count)', false),
  ('baron', 'Baron', 'minion', 'tb', 'There are extra Outsiders in play. [+2 Outsiders]', false),
  ('imp', 'Imp', 'demon', 'tb', 'Each night*, choose a player: they die. If you kill yourself this way, a Minion becomes the Imp.', false)
on conflict do nothing;

-- =========================================================================
-- Official characters — Bad Moon Rising (bmr)
-- =========================================================================
insert into public.characters (character_id, name, team, edition, ability, is_homebrew) values
  ('grandmother', 'Grandmother', 'townsfolk', 'bmr', 'You start knowing a good player & their character. If the Demon kills them, you die too.', false),
  ('sailor', 'Sailor', 'townsfolk', 'bmr', 'Each night, choose an alive player: either you or they are drunk until dusk. You can''t die.', false),
  ('chambermaid', 'Chambermaid', 'townsfolk', 'bmr', 'Each night, choose 2 alive players (not yourself): you learn how many woke tonight due to their ability.', false),
  ('exorcist', 'Exorcist', 'townsfolk', 'bmr', 'Each night*, choose a player (different to last night): the Demon, if chosen, learns who you are then doesn''t wake tonight.', false),
  ('innkeeper', 'Innkeeper', 'townsfolk', 'bmr', 'Each night*, choose 2 players: they can''t die tonight, but 1 is drunk until dusk.', false),
  ('gambler', 'Gambler', 'townsfolk', 'bmr', 'Each night*, choose a player & guess their character: if you guess wrong, you die.', false),
  ('gossip', 'Gossip', 'townsfolk', 'bmr', 'Each day, you may make a public statement. Tonight, if it was true, a player dies.', false),
  ('courtier', 'Courtier', 'townsfolk', 'bmr', 'Once per game, at night, choose a character: they are drunk for 3 nights & 3 days.', false),
  ('professor', 'Professor', 'townsfolk', 'bmr', 'Once per game, at night*, choose a dead player: if they are a Townsfolk, they are resurrected.', false),
  ('minstrel', 'Minstrel', 'townsfolk', 'bmr', 'When a Minion dies by execution, all other players (except Travellers) are drunk until dusk tomorrow.', false),
  ('tealady', 'Tea Lady', 'townsfolk', 'bmr', 'If both your alive neighbours are good, they can''t die.', false),
  ('pacifist', 'Pacifist', 'townsfolk', 'bmr', 'Executed good players might not die.', false),
  ('fool', 'Fool', 'townsfolk', 'bmr', 'The first time you die, you don''t.', false),
  ('tinker', 'Tinker', 'outsider', 'bmr', 'You might die at any time.', false),
  ('moonchild', 'Moonchild', 'outsider', 'bmr', 'When you learn that you died, publicly choose 1 alive player. Tonight, if it was a good player, they die.', false),
  ('goon', 'Goon', 'outsider', 'bmr', 'Each night, the 1st player to choose you with their ability is drunk until dusk. You become their alignment.', false),
  ('lunatic', 'Lunatic', 'outsider', 'bmr', 'You think you are a Demon, but you are not. The Demon knows who you are & who you choose at night.', false),
  ('godfather', 'Godfather', 'minion', 'bmr', 'You start knowing which Outsiders are in play. If 1 died today, choose a player tonight: they die.', false),
  ('devilsadvocate', 'Devil''s Advocate', 'minion', 'bmr', 'Each night, choose a living player (different to last night): if executed tomorrow, they don''t die.', false),
  ('assassin', 'Assassin', 'minion', 'bmr', 'Once per game, at night*, choose a player: they die, even if for some reason they could not.', false),
  ('mastermind', 'Mastermind', 'minion', 'bmr', 'If the Demon dies by execution (ending the game), play for 1 more day. If a player is then executed, their team loses.', false),
  ('zombuul', 'Zombuul', 'demon', 'bmr', 'Each night*, if no-one died today, choose a player: they die. The 1st time you die, you live but register as dead.', false),
  ('pukka', 'Pukka', 'demon', 'bmr', 'Each night, choose a player: they are poisoned. The previously poisoned player dies then becomes healthy.', false),
  ('shabaloth', 'Shabaloth', 'demon', 'bmr', 'Each night*, choose 2 players: they die. A dead player you chose last night might be regurgitated.', false),
  ('po', 'Po', 'demon', 'bmr', 'Each night*, you may choose a player: they die. If your last choice was no-one, choose 3 players tonight.', false)
on conflict do nothing;

-- =========================================================================
-- Official characters — Sects & Violets (snv)
-- =========================================================================
insert into public.characters (character_id, name, team, edition, ability, is_homebrew) values
  ('clockmaker', 'Clockmaker', 'townsfolk', 'snv', 'You start knowing how many steps from the Demon to its nearest Minion.', false),
  ('dreamer', 'Dreamer', 'townsfolk', 'snv', 'Each night, choose a player (not yourself or Travellers): you learn 1 good and 1 evil character, 1 of which is correct.', false),
  ('snakecharmer', 'Snake Charmer', 'townsfolk', 'snv', 'Each night, choose an alive player: a chosen Demon swaps characters & alignments with you & is then poisoned.', false),
  ('mathematician', 'Mathematician', 'townsfolk', 'snv', 'Each night, you learn how many players'' abilities worked abnormally (since dawn) due to another character''s ability.', false),
  ('flowergirl', 'Flowergirl', 'townsfolk', 'snv', 'Each night*, you learn if a Demon voted today.', false),
  ('towncrier', 'Town Crier', 'townsfolk', 'snv', 'Each night*, you learn if a Minion nominated today.', false),
  ('oracle', 'Oracle', 'townsfolk', 'snv', 'Each night*, you learn how many dead players are evil.', false),
  ('savant', 'Savant', 'townsfolk', 'snv', 'Each day, you may visit the Storyteller to learn 2 things in private: 1 is true & 1 is false.', false),
  ('seamstress', 'Seamstress', 'townsfolk', 'snv', 'Once per game, at night, choose 2 players (not yourself): you learn if they are the same alignment.', false),
  ('philosopher', 'Philosopher', 'townsfolk', 'snv', 'Once per game, at night, choose a good character: gain that ability. If this character is in play, they are drunk.', false),
  ('artist', 'Artist', 'townsfolk', 'snv', 'Once per game, during the day, privately ask the Storyteller any yes/no question.', false),
  ('juggler', 'Juggler', 'townsfolk', 'snv', 'On your 1st day, publicly guess up to 5 players'' characters. That night, you learn how many you got correct.', false),
  ('sage', 'Sage', 'townsfolk', 'snv', 'If the Demon kills you, you learn that it is 1 of 2 players.', false),
  ('mutant', 'Mutant', 'outsider', 'snv', 'If you are "mad" about being an Outsider, you might be executed.', false),
  ('sweetheart', 'Sweetheart', 'outsider', 'snv', 'When you die, 1 player is drunk from now on.', false),
  ('barber', 'Barber', 'outsider', 'snv', 'If you died today or tonight, the Demon may choose 2 players (not another Demon) to swap characters.', false),
  ('klutz', 'Klutz', 'outsider', 'snv', 'When you learn that you died, publicly choose 1 alive player: if they are evil, your team loses.', false),
  ('eviltwin', 'Evil Twin', 'minion', 'snv', 'You & an opposing player know each other. If the good player is executed, evil wins. Good can''t win if you both live.', false),
  ('witch', 'Witch', 'minion', 'snv', 'Each night, choose a player: if they nominate tomorrow, they die. If just 3 players live, you lose this ability.', false),
  ('cerenovus', 'Cerenovus', 'minion', 'snv', 'Each night, choose a player & a good character: they are "mad" they are this character tomorrow, or might be executed.', false),
  ('pithag', 'Pit-Hag', 'minion', 'snv', 'Each night*, choose a player & a character they become (if not-in-play). If a Demon is made, deaths tonight are arbitrary.', false),
  ('fanggu', 'Fang Gu', 'demon', 'snv', 'Each night*, choose a player: they die. The 1st Outsider this kills becomes an evil Fang Gu & you die instead. [+1 Outsider]', false),
  ('vigormortis', 'Vigormortis', 'demon', 'snv', 'Each night*, choose a player: they die. Minions you kill keep their ability & poison 1 Townsfolk neighbour. [-1 Outsider]', false),
  ('nodashii', 'No Dashii', 'demon', 'snv', 'Each night*, choose a player: they die. Your 2 Townsfolk neighbours are poisoned.', false),
  ('vortox', 'Vortox', 'demon', 'snv', 'Each night*, choose a player: they die. Townsfolk abilities yield false info. Each day, if no-one is executed, evil wins.', false)
on conflict do nothing;

-- =========================================================================
-- Script 1: Trouble Brewing (official base script)
-- =========================================================================
with new_script as (
  insert into public.scripts (name, description, script_json, edition)
  values (
    'Trouble Brewing',
    'The original Blood on the Clocktower script — the recommended first script for new groups.',
    '[
      {"id": "_meta", "name": "Trouble Brewing", "author": "The Pandemonium Institute"},
      "washerwoman", "librarian", "investigator", "chef", "empath", "fortuneteller",
      "undertaker", "monk", "ravenkeeper", "virgin", "slayer", "soldier", "mayor",
      "butler", "drunk", "recluse", "saint",
      "poisoner", "spy", "scarletwoman", "baron",
      "imp"
    ]'::jsonb,
    'tb'
  )
  returning id
)
insert into public.script_characters (script_id, character_id)
select ns.id, c.id
from new_script ns, public.characters c
where c.edition = 'tb';

-- =========================================================================
-- Script 2: Bad Moon Rising (official base script)
-- =========================================================================
with new_script as (
  insert into public.scripts (name, description, script_json, edition)
  values (
    'Bad Moon Rising',
    'The second official script — higher lethality, multiple demon options.',
    '[
      {"id": "_meta", "name": "Bad Moon Rising", "author": "The Pandemonium Institute"},
      "grandmother", "sailor", "chambermaid", "exorcist", "innkeeper", "gambler",
      "gossip", "courtier", "professor", "minstrel", "tealady", "pacifist", "fool",
      "tinker", "moonchild", "goon", "lunatic",
      "godfather", "devilsadvocate", "assassin", "mastermind",
      "zombuul", "pukka", "shabaloth", "po"
    ]'::jsonb,
    'bmr'
  )
  returning id
)
insert into public.script_characters (script_id, character_id)
select ns.id, c.id
from new_script ns, public.characters c
where c.edition = 'bmr';

-- =========================================================================
-- Script 3: Sects & Violets (official base script)
-- =========================================================================
with new_script as (
  insert into public.scripts (name, description, script_json, edition)
  values (
    'Sects & Violets',
    'The third official script — information-heavy, with madness and misinformation.',
    '[
      {"id": "_meta", "name": "Sects & Violets", "author": "The Pandemonium Institute"},
      "clockmaker", "dreamer", "snakecharmer", "mathematician", "flowergirl", "towncrier",
      "oracle", "savant", "seamstress", "philosopher", "artist", "juggler", "sage",
      "mutant", "sweetheart", "barber", "klutz",
      "eviltwin", "witch", "cerenovus", "pithag",
      "fanggu", "vigormortis", "nodashii", "vortox"
    ]'::jsonb,
    'snv'
  )
  returning id
)
insert into public.script_characters (script_id, character_id)
select ns.id, c.id
from new_script ns, public.characters c
where c.edition = 'snv';

-- =========================================================================
-- Script 4 (EXAMPLE / PLACEHOLDER): "The Golden Hour" — a custom script built
-- entirely from official characters mixed across all 3 editions. Common,
-- legitimate pattern in the real community; invented for Phase 1 seed data.
-- =========================================================================
with new_script as (
  insert into public.scripts (name, description, script_json, edition)
  values (
    'The Golden Hour',
    'Example custom script (Phase 1 seed data, not a real published community script) — a "greatest hits" mix of characters from all three editions.',
    '[
      {"id": "_meta", "name": "The Golden Hour", "author": "botchub example script"},
      "washerwoman", "investigator", "empath", "undertaker", "monk",
      "grandmother", "chambermaid", "gambler", "minstrel",
      "clockmaker", "dreamer", "oracle", "juggler",
      "drunk", "recluse", "tinker", "mutant",
      "poisoner", "spy", "godfather", "witch",
      "imp"
    ]'::jsonb,
    null
  )
  returning id
)
insert into public.script_characters (script_id, character_id)
select ns.id, c.id
from new_script ns,
     public.characters c
where c.character_id = any (array[
        'washerwoman','investigator','empath','undertaker','monk',
        'grandmother','chambermaid','gambler','minstrel',
        'clockmaker','dreamer','oracle','juggler',
        'drunk','recluse','tinker','mutant',
        'poisoner','spy','godfather','witch',
        'imp'
      ])
  and c.is_homebrew = false;

-- =========================================================================
-- Script 5 (EXAMPLE / PLACEHOLDER): "Fogbound Isle" — a small Teensyville-
-- style script with one invented homebrew demon, to exercise the homebrew
-- character path end to end. Ability text is unbalanced/unplaytested demo
-- content, not a real character — replace before launch.
-- =========================================================================
with new_homebrew_character as (
  insert into public.characters (character_id, name, team, edition, ability, is_homebrew)
  values (
    'lighthousekeeper',
    'Lighthouse Keeper',
    'demon',
    null,
    'Each night*, choose a player: they die. (Placeholder ability — invented for Phase 1 seed data, not playtested.)',
    true
  )
  returning id, character_id
),
new_script as (
  insert into public.scripts (name, description, script_json, edition)
  values (
    'Fogbound Isle',
    'Example custom script (Phase 1 seed data, not a real published community script) — a small Teensyville-sized script with one invented homebrew character, the Lighthouse Keeper.',
    '[
      {"id": "_meta", "name": "Fogbound Isle", "author": "botchub example script"},
      "fortuneteller", "flowergirl", "snakecharmer", "sailor", "exorcist",
      "saint",
      "baron", "cerenovus",
      {
        "id": "lighthousekeeper",
        "name": "Lighthouse Keeper",
        "team": "demon",
        "ability": "Each night*, choose a player: they die. (Placeholder ability — invented for Phase 1 seed data, not playtested.)"
      }
    ]'::jsonb,
    null
  )
  returning id
)
insert into public.script_characters (script_id, character_id)
select ns.id, c.id
from new_script ns, public.characters c
where c.character_id = any (array['fortuneteller','flowergirl','snakecharmer','sailor','exorcist','saint','baron','cerenovus'])
  and c.is_homebrew = false
union all
select ns.id, nhc.id
from new_script ns, new_homebrew_character nhc;
