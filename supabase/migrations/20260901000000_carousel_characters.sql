-- Adds 27 official characters that exist in the live, official Script Tool
-- (script.bloodontheclocktower.com, run by Steven Medway / The Pandemonium
-- Institute) but were absent from both our Phase 1 seed data and the
-- bra1n/townsquare data set used for the previous character-library
-- expansion (20260831020000). These are the game's "Carousel" / Experimental
-- pool -- officially released characters that don't belong to a single base
-- edition (Trouble Brewing / Bad Moon Rising / Sects & Violets), the same
-- category Travellers and "extras" already fall into, so edition is left
-- null here exactly as it is for those.
--
-- Source of truth for id/name/team/ability: extracted directly from
-- script.bloodontheclocktower.com's own live application data (its shipped
-- role definitions), not a third party mirror -- confirmed against the
-- in-app character reference panel before writing this migration.
--
-- Source for icon_url: wiki.bloodontheclocktower.com (the official
-- Blood on the Clocktower wiki, hosted under the game's own domain), whose
-- MediaWiki-hosted images are stable, permanent URLs -- unlike
-- script.bloodontheclocktower.com's own assets, which are Vite build
-- artifacts with content-hashed filenames that change on every deploy and
-- so cannot be hotlinked long-term. Resolved via the wiki's own API
-- (action=query&prop=imageinfo) rather than guessed, since MediaWiki upload
-- paths are content-hash directories, not derivable from the character id.
--
-- Same known caveat as the previous character-library migration: these are
-- hotlinked from an external host as a stopgap until this project has
-- Supabase Storage write access to self-host character art.

insert into public.characters (character_id, name, team, edition, ability, is_homebrew, icon_url)
values
  ('steward', 'Steward', 'townsfolk', null, 'You start knowing 1 good player.', false, 'https://wiki.bloodontheclocktower.com/images/f/fe/Icon_steward.png'),
  ('knight', 'Knight', 'townsfolk', null, 'You start knowing 2 players that are not the Demon.', false, 'https://wiki.bloodontheclocktower.com/images/8/8e/Icon_knight.png'),
  ('shugenja', 'Shugenja', 'townsfolk', null, 'You start knowing if your closest evil player is clockwise or anti-clockwise. If equidistant, this info is arbitrary.', false, 'https://wiki.bloodontheclocktower.com/images/1/11/Icon_shugenja.png'),
  ('highpriestess', 'High Priestess', 'townsfolk', null, 'Each night, learn which player the Storyteller believes you should talk to most.', false, 'https://wiki.bloodontheclocktower.com/images/6/63/Icon_highpriestess.png'),
  ('villageidiot', 'Village Idiot', 'townsfolk', null, 'Each night, choose a player: you learn their alignment. [+0 to +2 Village Idiots. 1 of the extras is drunk]', false, 'https://wiki.bloodontheclocktower.com/images/d/da/Icon_villageidiot.png'),
  ('alsaahir', 'Alsaahir', 'townsfolk', null, 'Each day, if you publicly guess which players are Minion(s) and which are Demon(s), good wins.', false, 'https://wiki.bloodontheclocktower.com/images/8/8e/Icon_alsaahir.png'),
  ('princess', 'Princess', 'townsfolk', null, 'On your 1st day, if you nominated & executed a player, the Demon doesn''t kill tonight.', false, 'https://wiki.bloodontheclocktower.com/images/3/36/Icon_princess.png'),
  ('banshee', 'Banshee', 'townsfolk', null, 'If the Demon kills you, all players learn this. From now on, you may nominate twice per day and vote twice per nomination.', false, 'https://wiki.bloodontheclocktower.com/images/6/63/Icon_banshee.png'),
  ('hermit', 'Hermit', 'outsider', null, 'You have all Outsider abilities. [-0 or -1 Outsider]', false, 'https://wiki.bloodontheclocktower.com/images/b/b4/Icon_hermit.png'),
  ('ogre', 'Ogre', 'outsider', null, 'On your 1st night, choose a player (not yourself): you become their alignment (you don''t know which) even if drunk or poisoned.', false, 'https://wiki.bloodontheclocktower.com/images/2/25/Icon_ogre.png'),
  ('plaguedoctor', 'Plague Doctor', 'outsider', null, 'When you die, the Storyteller gains a Minion ability.', false, 'https://wiki.bloodontheclocktower.com/images/e/e2/Icon_plaguedoctor.png'),
  ('hatter', 'Hatter', 'outsider', null, 'If you died today or tonight, the Minion & Demon players may choose new Minion & Demon characters to be.', false, 'https://wiki.bloodontheclocktower.com/images/4/44/Icon_hatter.png'),
  ('zealot', 'Zealot', 'outsider', null, 'If there are 5 or more players alive, you must vote for every nomination.', false, 'https://wiki.bloodontheclocktower.com/images/1/16/Icon_zealot.png'),
  ('harpy', 'Harpy', 'minion', null, 'Each night, choose 2 players: tomorrow, the 1st player is mad that the 2nd is evil, or one or both might die.', false, 'https://wiki.bloodontheclocktower.com/images/d/d3/Icon_harpy.png'),
  ('wizard', 'Wizard', 'minion', null, 'Once per game, choose to make a wish. If granted, it might have a price & leave a clue as to its nature.', false, 'https://wiki.bloodontheclocktower.com/images/b/b5/Icon_wizard.png'),
  ('xaan', 'Xaan', 'minion', null, 'On night X, all Townsfolk are poisoned until dusk. [X Outsiders]', false, 'https://wiki.bloodontheclocktower.com/images/0/0c/Icon_xaan.png'),
  ('wraith', 'Wraith', 'minion', null, 'You may choose to open your eyes at night. You wake when other evil players do.', false, 'https://wiki.bloodontheclocktower.com/images/8/8f/Icon_wraith.png'),
  ('summoner', 'Summoner', 'minion', null, 'You get 3 bluffs. On the 3rd night, choose a player: they become an evil Demon of your choice. [No Demon]', false, 'https://wiki.bloodontheclocktower.com/images/1/1a/Icon_summoner.png'),
  ('vizier', 'Vizier', 'minion', null, 'All players know you are the Vizier. You cannot die during the day. If good voted, you may choose to execute immediately.', false, 'https://wiki.bloodontheclocktower.com/images/a/a4/Icon_vizier.png'),
  ('organgrinder', 'Organ Grinder', 'minion', null, 'All players keep their eyes closed when voting and the vote tally is secret. Each night, choose if you are drunk until dusk.', false, 'https://wiki.bloodontheclocktower.com/images/6/61/Icon_organgrinder.png'),
  ('boffin', 'Boffin', 'minion', null, 'The Demon (even if drunk or poisoned) has a not-in-play good character’s ability. You both know which.', false, 'https://wiki.bloodontheclocktower.com/images/e/e0/Icon_boffin.png'),
  ('yaggababble', 'Yaggababble', 'demon', null, 'You start knowing a secret phrase. For each time you said it publicly today, a player might die.', false, 'https://wiki.bloodontheclocktower.com/images/0/08/Icon_yaggababble.png'),
  ('ojo', 'Ojo', 'demon', null, 'Each night*, choose a character: they die. If they are not in play, the Storyteller chooses who dies.', false, 'https://wiki.bloodontheclocktower.com/images/6/6f/Icon_ojo.png'),
  ('kazali', 'Kazali', 'demon', null, 'Each night*, choose a player: they die. [You choose which players are which Minions. -? to +? Outsiders]', false, 'https://wiki.bloodontheclocktower.com/images/3/3c/Icon_kazali.png'),
  ('lordoftyphon', 'Lord of Typhon', 'demon', null, 'Each night*, choose a player: they die. [Evil characters are in a line. You are in the middle. +1 Minion. -? to +? Outsiders]', false, 'https://wiki.bloodontheclocktower.com/images/c/cf/Icon_lordoftyphon.png'),
  ('cacklejack', 'Cacklejack', 'traveller', null, 'Each day, choose a player: a different player changes character tonight.', false, 'https://wiki.bloodontheclocktower.com/images/d/d7/Icon_cacklejack.png'),
  ('gnome', 'Gnome', 'traveller', null, 'All players start knowing a player of your alignment. You may choose to kill anyone who nominates them.', false, 'https://wiki.bloodontheclocktower.com/images/e/e0/Icon_gnome.png')
on conflict (character_id) where is_homebrew = false do nothing;
