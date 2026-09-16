"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { GameActionState } from "@/lib/game-action-state";
import type { Alignment, Duration, LastPhase, LogType } from "@/lib/types";

const ALIGNMENTS: readonly Alignment[] = ["good", "evil"];
const DURATIONS: readonly Duration[] = [
  "under_45",
  "from_45_to_90",
  "from_90_to_135",
  "over_135",
];
const LAST_PHASES: readonly LastPhase[] = ["day", "night"];

function parseEnum<T extends string>(
  value: FormDataEntryValue | null,
  allowed: readonly T[],
): T | null {
  const s = String(value ?? "").trim();
  return (allowed as readonly string[]).includes(s) ? (s as T) : null;
}

function friendlyError(message: string): string {
  return message || "Something went wrong. Please try again.";
}

/**
 * Handles both Fast Log and Detailed Log submits — they're the same form
 * with a few extra fields, distinguished by the hidden `logType` input (see
 * GameLogForm). Group codes are resolved to real group ids *before*
 * anything is written, so a bad/foreign code fails the whole submit instead
 * of leaving an orphaned game row behind. A resolved id here already proves
 * the signed-in user belongs to that group — groups' own RLS policy only
 * lets a member/owner SELECT it by invite_code in the first place, so a
 * stranger's code simply doesn't resolve (see the game_logging_fields
 * migration's game_groups policies for the same check enforced again at
 * insert time).
 */
export async function logGameAction(
  _prevState: GameActionState,
  formData: FormData,
): Promise<GameActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be logged in." };
  }

  const logType: LogType =
    String(formData.get("logType") ?? "") === "detailed" ? "detailed" : "fast";
  const isDetailed = logType === "detailed";

  const scriptId = String(formData.get("scriptId") ?? "").trim();
  const externalScriptName = String(formData.get("externalScriptName") ?? "").trim();
  if (!scriptId && !externalScriptName) {
    return { error: "Pick which script was played." };
  }

  const selfIsStoryteller = formData.get("selfIsStoryteller") === "true";

  const winningTeam = parseEnum(formData.get("winningTeam"), ALIGNMENTS);
  if (!winningTeam) {
    return { error: "Pick which team won." };
  }

  let characterId: string | null = null;
  let selfAlignment: Alignment | null = null;
  if (!selfIsStoryteller) {
    characterId = String(formData.get("characterId") ?? "").trim() || null;
    selfAlignment = parseEnum(formData.get("selfAlignment"), ALIGNMENTS);
    if (!characterId || !selfAlignment) {
      return {
        error: "Pick your character and your alignment (or check Storyteller).",
      };
    }
  }

  const duration = parseEnum(formData.get("duration"), DURATIONS);
  if (!duration) {
    return { error: "Pick how long the game lasted." };
  }

  const storytellerMistakes = formData.get("storytellerMistakes") === "true";
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const playedAtRaw = String(formData.get("playedAt") ?? "").trim();
  // A bare "YYYY-MM-DD" from <input type="date"> has no time-of-day, so
  // parsing it straight would land on midnight UTC and could read as the
  // *previous* day in a timezone behind UTC — anchoring to local noon
  // avoids that without needing a full timezone-aware date library here.
  const playedAt = playedAtRaw
    ? new Date(`${playedAtRaw}T12:00:00`).toISOString()
    : new Date().toISOString();

  let finalThree: boolean | null = null;
  let lastPhase: LastPhase | null = null;
  let lastPhaseNumber: number | null = null;
  let playerNames: string[] = [];
  if (isDetailed) {
    finalThree = formData.get("finalThree") === "true";
    lastPhase = parseEnum(formData.get("lastPhase"), LAST_PHASES);
    const lastPhaseNumberRaw = String(
      formData.get("lastPhaseNumber") ?? "",
    ).trim();
    if (lastPhaseNumberRaw) {
      const n = Number(lastPhaseNumberRaw);
      lastPhaseNumber = Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
    }
    playerNames = formData
      .getAll("playerNames")
      .map((v) => String(v).trim())
      .filter(Boolean);
  }

  const groupCodes = Array.from(
    new Set(
      formData
        .getAll("groupCodes")
        .map((v) => String(v).trim())
        .filter(Boolean),
    ),
  );

  const groupIds: string[] = [];
  for (const code of groupCodes) {
    const { data: group, error: groupError } = await supabase
      .from("groups")
      .select("id")
      .eq("invite_code", code)
      .maybeSingle();
    if (groupError) {
      return { error: friendlyError(groupError.message) };
    }
    if (!group) {
      return {
        error: `Group code "${code}" wasn't found — double check it, or make sure you've joined that group first.`,
      };
    }
    groupIds.push(group.id as string);
  }

  const { data: game, error: gameError } = await supabase
    .from("games")
    .insert({
      created_by: user.id,
      script_id: scriptId || null,
      external_script_name: scriptId ? null : externalScriptName,
      played_at: playedAt,
      log_type: logType,
      self_is_storyteller: selfIsStoryteller,
      winning_team: winningTeam,
      storyteller_mistakes: storytellerMistakes,
      duration,
      final_three: finalThree,
      last_phase: lastPhase,
      last_phase_number: lastPhaseNumber,
      notes,
    })
    .select("id")
    .single();

  if (gameError || !game) {
    return { error: friendlyError(gameError?.message ?? "") };
  }

  const playerRows: {
    game_id: string;
    user_id?: string;
    display_name?: string;
    character_id?: string;
    team?: Alignment;
    won?: boolean;
  }[] = [];

  if (!selfIsStoryteller && characterId && selfAlignment) {
    playerRows.push({
      game_id: game.id,
      user_id: user.id,
      character_id: characterId,
      team: selfAlignment,
      won: selfAlignment === winningTeam,
    });
  }

  for (const name of playerNames) {
    playerRows.push({ game_id: game.id, display_name: name });
  }

  if (playerRows.length > 0) {
    const { error: playersError } = await supabase
      .from("game_players")
      .insert(playerRows);
    if (playersError) {
      return { error: friendlyError(playersError.message) };
    }
  }

  if (groupIds.length > 0) {
    const { error: groupsError } = await supabase
      .from("game_groups")
      .insert(groupIds.map((groupId) => ({ game_id: game.id, group_id: groupId })));
    if (groupsError) {
      return { error: friendlyError(groupsError.message) };
    }
  }

  revalidatePath("/games/history");
  redirect("/games/history?logged=1");
}
