-- botchub — fix Acrobat's team (data bug, not a rendering bug)
--
-- Diego reported Acrobat rendering under OUTSIDER on both a script page
-- and the generated PDF, when the official Script Tool (and every other
-- primary source checked here) has it as TOWNSFOLK. Root cause: the Phase
-- 2 follow-up #2 migration (20260831020000_character_library_expansion.sql)
-- seeded Acrobat's team from bra1n/townsquare's roles.json, and that
-- third-party mirror itself has Acrobat mislabeled 'outsider' — confirmed
-- directly against the raw file, not just a summarized read. The official
-- wiki's own Acrobat page and its Townsfolk/Outsider category listings
-- (wiki.bloodontheclocktower.com) both agree: Acrobat is Townsfolk, an
-- Experimental-edition character, and does not appear in the Outsider
-- category at all.
--
-- Spot-checked the rest of that same 58-character migration batch against
-- the wiki's Townsfolk/Outsider/Minion/Demon/Traveller category pages
-- while tracking this down — every other character in that batch matches
-- its official team. Acrobat looks like an isolated bad entry in the
-- upstream source, not a systemic import problem.
update public.characters
set team = 'townsfolk'
where character_id = 'acrobat' and is_homebrew = false;
