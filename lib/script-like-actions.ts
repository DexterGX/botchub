"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getScriptLikeCount } from "@/lib/queries";

export interface ToggleLikeResult {
  ok: boolean;
  liked: boolean;
  count: number;
  error?: string;
}

/**
 * Toggles the signed-in user's like on a script. `script_likes` is a
 * plain (script_id, user_id) join table (see
 * supabase/migrations/20260828000000_initial_schema.sql) with row-level
 * security already scoping insert/delete to rows where user_id matches
 * the caller — so "like" is just an insert of that row and "unlike" a
 * delete of it; this only needs to check which state we're currently in
 * and flip it.
 *
 * Called directly from the client LikeButton (app/scripts/LikeButton.tsx)
 * as a server action — the button already applies an optimistic update
 * before this resolves, and reverts it if `ok` comes back false.
 */
export async function toggleScriptLikeAction(
  scriptId: string,
): Promise<ToggleLikeResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      liked: false,
      count: 0,
      error: "You need to be logged in to like scripts.",
    };
  }

  const { data: existing, error: lookupError } = await supabase
    .from("script_likes")
    .select("script_id")
    .eq("script_id", scriptId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (lookupError) {
    return { ok: false, liked: false, count: 0, error: lookupError.message };
  }

  if (existing) {
    const { error: deleteError } = await supabase
      .from("script_likes")
      .delete()
      .eq("script_id", scriptId)
      .eq("user_id", user.id);
    if (deleteError) {
      return { ok: false, liked: true, count: 0, error: deleteError.message };
    }
  } else {
    const { error: insertError } = await supabase
      .from("script_likes")
      .insert({ script_id: scriptId, user_id: user.id });
    if (insertError) {
      return { ok: false, liked: false, count: 0, error: insertError.message };
    }
  }

  const count = await getScriptLikeCount(scriptId);

  // Both surfaces that show a like count (the browse list and this
  // script's own detail page) need to reflect the change on next load —
  // the button itself already updates instantly from this action's
  // return value, this is just so a fresh page load (or another tab)
  // isn't stale.
  revalidatePath("/scripts");
  revalidatePath(`/scripts/${scriptId}`);

  return { ok: true, liked: !existing, count };
}
