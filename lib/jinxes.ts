import type { Character, ScriptJsonEntry } from "@/lib/types";
import { isCharacterObjectEntry } from "@/lib/types";

/** One row from the `character_jinxes` table (see
 * supabase/migrations/20260914000000_character_jinxes.sql) — the
 * game-wide official jinx pairs, keyed by `characters.id` (uuid), not
 * script-specific. `getJinxesForCharacterIds` (lib/queries.ts) returns
 * these already filtered to pairs where both sides are on one script. */
export interface GlobalJinxRow {
  characterAId: string;
  characterBId: string;
  reason: string;
}

export interface JinxEntry {
  key: string;
  nameA: string;
  nameB: string;
  /** characters.id (uuid), when resolvable — used to look up an already-
   * loaded icon buffer. Null for an inline jinx referencing an id this
   * script doesn't actually resolve to a known character (falls back to
   * a lettered badge, same as everywhere else icons can be missing). */
  idA: string | null;
  idB: string | null;
  reason: string;
}

/**
 * Combines two jinx sources for a script into one deduplicated list:
 *
 *  1. Inline jinxes embedded directly in the script's own JSON, per the
 *     official script-schema.json's per-character `jinxes: [{id, reason}]`
 *     shape. Rare in practice — script.bloodontheclocktower.com exports
 *     reference official characters as bare `{id}` entries, which never
 *     carry this — but honored when present, since it's script-specific
 *     and could deliberately override or clarify the general rule.
 *  2. The game-wide official jinx pairs from `character_jinxes`, for
 *     whichever pairs of this script's own characters both appear in
 *     that table. This is what actually covers real scripts — including
 *     the one that prompted this (Diego's "Babciu, czemu masz takie
 *     wielkie zęby?"), whose upload has no inline jinx data at all, the
 *     same as virtually every script exported from the official tool.
 *
 * Inline wins on a duplicate pair — a script author's own note about a
 * specific interaction is more specific than the general rule.
 */
export function resolveJinxesForScript(
  scriptJson: ScriptJsonEntry[],
  characters: Character[],
  globalJinxes: GlobalJinxRow[],
): JinxEntry[] {
  const byCharacterId = new Map(characters.map((c) => [c.character_id, c]));
  const byUuid = new Map(characters.map((c) => [c.id, c]));
  const jinxes: JinxEntry[] = [];
  const seenPairs = new Set<string>();

  for (const entry of scriptJson) {
    if (!isCharacterObjectEntry(entry)) continue;
    const rawJinxes = entry.jinxes;
    if (!Array.isArray(rawJinxes)) continue;

    const idA = entry.id;
    const charA = byCharacterId.get(idA);
    const nameA = charA?.name ?? entry.name ?? idA;

    for (const raw of rawJinxes) {
      if (!raw || typeof raw !== "object") continue;
      const idB = (raw as { id?: unknown }).id;
      const reason = (raw as { reason?: unknown }).reason;
      if (typeof idB !== "string" || typeof reason !== "string" || !reason) {
        continue;
      }
      const pairKey = [idA, idB].sort().join("|");
      if (seenPairs.has(pairKey)) continue;
      seenPairs.add(pairKey);
      const charB = byCharacterId.get(idB);
      jinxes.push({
        key: pairKey,
        nameA,
        nameB: charB?.name ?? idB,
        idA: charA?.id ?? null,
        idB: charB?.id ?? null,
        reason,
      });
    }
  }

  for (const row of globalJinxes) {
    const charA = byUuid.get(row.characterAId);
    const charB = byUuid.get(row.characterBId);
    if (!charA || !charB) continue;
    const pairKey = [charA.character_id, charB.character_id].sort().join("|");
    if (seenPairs.has(pairKey)) continue;
    seenPairs.add(pairKey);
    jinxes.push({
      key: pairKey,
      nameA: charA.name,
      nameB: charB.name,
      idA: charA.id,
      idB: charB.id,
      reason: row.reason,
    });
  }

  return jinxes;
}

/** For each character that's the *first*-listed side of at least one
 * resolved jinx, the other character it's jinxed with — used to show a
 * small icon of the counterpart right next to a character's own name on
 * the character sheet (both the PDF's CharacterEntry and the website's
 * team grid), so a player can see at a glance "this character interacts
 * specially with that one" without having to cross-reference the
 * separate Jinxes list.
 *
 * One-directional on purpose, matching the wiki's own convention (and
 * Diego's ask): for an "Alchemist & Boffin" jinx, only the Alchemist
 * shows the Boffin's icon — Boffin doesn't also show the Alchemist's.
 * `idA`/`nameA` is already "whichever character comes first" for every
 * jinx source this reads: an inline script jinx's `idA` is the character
 * whose own `jinxes` array it was listed under, and a DB-sourced jinx's
 * `character_a_id` preserves the order the wiki's own team-by-team pages
 * were scraped in (see resolveJinxesForScript / character_jinxes) — both
 * already match "the same order already shown in the Jinxes list's own
 * 'A & B' pair heading," so this reuses that instead of re-deriving a
 * separate direction.
 *
 * Only characters resolvable to a known `characters` row (idA/idB
 * non-null) can be shown this way — an inline jinx referencing an
 * unresolvable id has nothing to render an icon for. */
export function buildJinxCounterpartMap(
  jinxes: JinxEntry[],
): Map<string, { id: string; name: string }[]> {
  const map = new Map<string, { id: string; name: string }[]>();
  const add = (
    key: string | null,
    other: { id: string; name: string } | null,
  ) => {
    if (!key || !other) return;
    const list = map.get(key) ?? [];
    if (!list.some((x) => x.id === other.id)) list.push(other);
    map.set(key, list);
  };
  for (const j of jinxes) {
    add(j.idA, j.idB ? { id: j.idB, name: j.nameB } : null);
  }
  return map;
}

/**
 * Many community scripts that carry jinxes lean on the Djinn Fabled
 * character (ability: "Use the Djinn's special rule. All players know
 * what it is") as the in-game signal to players that a custom ruling is
 * active — but a script's own uploaded JSON usually only lists the roles
 * actually assigned to players, not this implied one, so Djinn often
 * doesn't come through on upload even when the script clearly has jinxes
 * (confirmed against several of Diego's own test uploads — "Magical Tea
 * Party," "Mastication," "Fear of Missing Outsiders" and one of the two
 * "Babciu..." imports all resolve real jinxes but never listed Djinn).
 * Per Diego's ask, when a script has any resolvable jinx and its own
 * character list doesn't already include Djinn, botchub shows the Djinn
 * badge anyway. This is the one place the app shows a character not
 * literally present in a script's own data — everywhere else follows a
 * strict "don't show what isn't there" rule — so it's worth revisiting if
 * this convention ever turns out not to match what players expect.
 */
export function withImpliedDjinn<C extends { character_id: string }>(
  characters: C[],
  jinxes: JinxEntry[],
  djinn: C | null,
): C[] {
  if (!djinn) return characters;
  if (jinxes.length === 0) return characters;
  if (characters.some((c) => c.character_id === "djinn")) return characters;
  return [...characters, djinn];
}
