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
