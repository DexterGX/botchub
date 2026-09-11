import type { Character } from "@/lib/types";

// Builds the "First night" / "Other nights" run sheets shown on a script's
// detail page — the same kind of listing botcscripts.com renders from its
// generated PDF, but built live from characters.first_night/other_night
// (backfilled in supabase/migrations/20260910000000_character_night_order.sql)
// instead of a PDF we don't generate.
//
// The four bracketing steps below (Dusk, Minion Info, Demon Info, Dawn) are
// not characters — they're fixed points in every game's night order, the
// same every script. Their wording here is transcribed verbatim from a
// botcscripts.com script page's own First/Other Night tables, not
// reconstructed from memory. Minion Info and Demon Info are placed
// immediately after Dusk and before every character row: we don't have a
// verified official global position number for those two reveal steps to
// interleave them precisely against early-waking characters, and in
// practice they come before essentially every character ability anyway
// (this matches how botcscripts.com, the official Script Tool, and other
// grimoire apps all render them).
export interface NightOrderEntry {
  key: string;
  name: string;
  reminder: string;
  iconUrl: string | null;
}

const DUSK: NightOrderEntry = {
  key: "dusk",
  name: "Dusk",
  reminder: "Start the Night Phase.",
  iconUrl: null,
};

const DAWN: NightOrderEntry = {
  key: "dawn",
  name: "Dawn",
  reminder: "Wait for a few seconds. End the Night Phase.",
  iconUrl: null,
};

const MINION_INFO: NightOrderEntry = {
  key: "minion-info",
  name: "Minion Info",
  reminder:
    "If there are 7 or more players, wake all Minions: Show the THIS IS THE DEMON token. Point to the Demon. Show THESE ARE YOUR MINIONS token. Point to the other Minions.",
  iconUrl: null,
};

const DEMON_INFO: NightOrderEntry = {
  key: "demon-info",
  name: "Demon Info",
  reminder:
    "If there are 7 or more players, wake the Demon. Show the Demon token. Show all Minions. Show the THESE CHARACTERS ARE NOT IN PLAY token. Show 3 not-in-play good character tokens.",
  iconUrl: null,
};

export interface NightOrderResult {
  firstNight: NightOrderEntry[];
  otherNight: NightOrderEntry[];
  /** Characters in this script that wake at night (per official data) but
   * have no first/other-night data yet in botchub — homebrew characters,
   * plus the still-unbackfilled newer official ones. Surfaced so the page
   * can say so honestly instead of silently dropping them. */
  missingData: Character[];
}

export function buildNightOrder(characters: Character[]): NightOrderResult {
  const firstNightChars = characters
    .filter((c) => (c.first_night ?? 0) > 0)
    .sort((a, b) => (a.first_night ?? 0) - (b.first_night ?? 0));

  const otherNightChars = characters
    .filter((c) => (c.other_night ?? 0) > 0)
    .sort((a, b) => (a.other_night ?? 0) - (b.other_night ?? 0));

  const toEntry = (
    c: Character,
    reminder: string | null,
  ): NightOrderEntry => ({
    key: c.id,
    name: c.name,
    reminder: reminder ?? "",
    iconUrl: c.icon_url,
  });

  const firstNight = firstNightChars.length
    ? [
        DUSK,
        MINION_INFO,
        DEMON_INFO,
        ...firstNightChars.map((c) => toEntry(c, c.first_night_reminder)),
        DAWN,
      ]
    : [];

  const otherNight = otherNightChars.length
    ? [DUSK, ...otherNightChars.map((c) => toEntry(c, c.other_night_reminder)), DAWN]
    : [];

  // A character is "missing data" for this purpose only if we have no
  // signal either way (both fields null) — a character that's genuinely
  // known not to wake at night (0/0) isn't missing anything.
  const missingData = characters.filter(
    (c) => c.first_night === null && c.other_night === null,
  );

  return { firstNight, otherNight, missingData };
}
