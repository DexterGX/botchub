"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { findGroupByCode } from "@/lib/queries";
import type { GroupActionState } from "@/lib/group-action-state";
import type { GroupVisibility, PublicGroupRow } from "@/lib/types";

function friendlyError(message: string): string {
  return message || "Something went wrong. Please try again.";
}

function parseInt10(value: FormDataEntryValue | null, fallback: number): number {
  const n = parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) ? n : fallback;
}

const COVER_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const COVER_IMAGE_EXTENSION_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/**
 * Creates a group (CreateGroupForm) — inserts the groups row with its
 * points-distribution config, then a group_members row for the owner
 * (see the "owner joins their own new group" RLS policy from the schema
 * migration — it only allows role='owner' for the actual groups.owner_id,
 * so this has to run after the groups insert, not alongside it).
 */
export async function createGroupAction(
  _prevState: GroupActionState,
  formData: FormData,
): Promise<GroupActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be logged in." };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { error: "Give the group a name." };
  }

  const description = String(formData.get("description") ?? "").trim() || null;

  // Same "read the File straight off FormData" shape as
  // uploadScriptAction — a native <input type=file> submits it through
  // without any client JS required.
  const coverImageFile = formData.get("coverImage");
  if (
    coverImageFile instanceof File &&
    coverImageFile.size > 0 &&
    !(coverImageFile.type in COVER_IMAGE_EXTENSION_BY_TYPE)
  ) {
    return { error: "Cover photo must be a PNG, JPEG, or WebP image." };
  }
  if (
    coverImageFile instanceof File &&
    coverImageFile.size > COVER_IMAGE_MAX_BYTES
  ) {
    return { error: "Cover photo must be 5MB or smaller." };
  }

  const visibility: GroupVisibility =
    String(formData.get("visibility") ?? "") === "public" ? "public" : "private";

  const hasPlaytime = formData.get("hasPlaytime") === "true";
  const playtimeStart = hasPlaytime
    ? String(formData.get("playtimeStart") ?? "").trim() || null
    : null;
  const playtimeEnd = hasPlaytime
    ? String(formData.get("playtimeEnd") ?? "").trim() || null
    : null;

  const countWins = formData.get("countWins") === "true";
  const winPoints = parseInt10(formData.get("winPoints"), 3);
  const winPointsMistake = parseInt10(formData.get("winPointsMistake"), 1);
  const countLosses = formData.get("countLosses") === "true";
  const lossPoints = parseInt10(formData.get("lossPoints"), -3);
  const lossPointsMistake = parseInt10(formData.get("lossPointsMistake"), -1);
  const countStoryteller = formData.get("countStoryteller") === "true";
  const storytellerPoints = parseInt10(formData.get("storytellerPoints"), 2);
  const storytellerPointsMistake = parseInt10(
    formData.get("storytellerPointsMistake"),
    1,
  );

  const { data: group, error: groupError } = await supabase
    .from("groups")
    .insert({
      owner_id: user.id,
      name,
      description,
      visibility,
      playtime_start: playtimeStart,
      playtime_end: playtimeEnd,
      count_wins: countWins,
      win_points: winPoints,
      win_points_mistake: winPointsMistake,
      count_losses: countLosses,
      loss_points: lossPoints,
      loss_points_mistake: lossPointsMistake,
      count_storyteller: countStoryteller,
      storyteller_points: storytellerPoints,
      storyteller_points_mistake: storytellerPointsMistake,
    })
    .select("id")
    .single();

  if (groupError || !group) {
    return { error: friendlyError(groupError?.message ?? "") };
  }

  const { error: memberError } = await supabase
    .from("group_members")
    .insert({ group_id: group.id, user_id: user.id, role: "owner" });

  if (memberError) {
    // The group exists but its owner-membership row failed — surface the
    // error rather than silently redirecting into a group the RLS-visible
    // member list won't show its own owner in.
    return { error: friendlyError(memberError.message) };
  }

  // The group-covers storage policies key off the group's own id in the
  // upload path (see the bucket migration), so this can only happen after
  // the groups row above exists — a chicken-and-egg the create-group form
  // can't avoid, since there's no group id before the group is created.
  // A failed upload here doesn't fail group creation: the cover photo is
  // cosmetic, and by this point the group and its owner membership are
  // already committed.
  if (coverImageFile instanceof File && coverImageFile.size > 0) {
    const extension = COVER_IMAGE_EXTENSION_BY_TYPE[coverImageFile.type];
    const path = `${group.id}/cover.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("group-covers")
      .upload(path, coverImageFile, {
        contentType: coverImageFile.type,
        upsert: true,
      });
    if (!uploadError) {
      const {
        data: { publicUrl },
      } = supabase.storage.from("group-covers").getPublicUrl(path);
      await supabase
        .from("groups")
        .update({ cover_image_url: publicUrl })
        .eq("id", group.id);
    }
  }

  revalidatePath("/groups");
  redirect(`/groups/${group.id}`);
}

export interface FindGroupByCodeResult {
  group:
    | (PublicGroupRow & { visibility: GroupVisibility; description: string | null })
    | null;
  /** The signed-in user's current relationship to the found group, so the
   * search result can render the right JoinGroupButton state right away
   * instead of always starting at "none" and only correcting itself after
   * a failed join attempt. */
  joinStatus: "none" | "member" | "pending";
}

/** The /groups/join "search by ID#" box — a server action wrapper around
 * lib/queries.ts's findGroupByCode() so the client search component can
 * call it directly, the same client-calls-a-thin-server-action shape as
 * requestToJoinGroupAction below. */
export async function findGroupByCodeAction(
  code: string,
): Promise<FindGroupByCodeResult> {
  if (!code.trim()) return { group: null, joinStatus: "none" };
  const group = await findGroupByCode(code);
  if (!group) return { group: null, joinStatus: "none" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { group, joinStatus: "none" };

  const { data: memberRow } = await supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", group.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (memberRow) return { group, joinStatus: "member" };

  const { data: requestRow } = await supabase
    .from("group_join_requests")
    .select("status")
    .eq("group_id", group.id)
    .eq("user_id", user.id)
    .maybeSingle();

  return {
    group,
    joinStatus: requestRow?.status === "pending" ? "pending" : "none",
  };
}

export interface JoinGroupResult {
  ok: boolean;
  /** "joined" — public group, membership granted immediately.
   * "requested" — private group, now waiting on the owner.
   * "already" — already a member or already has a pending request. */
  status: "joined" | "requested" | "already" | "error";
  error?: string;
}

/**
 * Called from the client (join-by-browsing or join-by-code, both funnel
 * here) with a resolved group id and its visibility, so this never needs
 * to re-derive visibility with a plain `select ... from groups` of its
 * own — that select is invisible under RLS for a PRIVATE group the caller
 * isn't a member of yet (RLS: "members and the owner can see a group" OR
 * "public groups are visible to everyone" — neither matches "someone who
 * just found this private group by its exact code"), which used to make
 * every private-group join request fail with "Group not found." every
 * caller already has the real visibility in hand: JoinByCodeSearch got it
 * from the SECURITY DEFINER find_group_by_code() RPC, the public-groups
 * browse list only ever lists visibility='public' groups, and the group
 * detail page's own "join this group" banner got it from getGroupById()
 * (which has its own SECURITY DEFINER fallback for the same reason — see
 * that function's comment). Trusting the caller's value here is safe even
 * if a client lied about it: the "self-join a public group" INSERT policy
 * independently re-checks the group's real visibility server-side, so a
 * spoofed "public" for an actually-private group would just fail the
 * insert rather than grant membership.
 */
export async function requestToJoinGroupAction(
  groupId: string,
  visibility: GroupVisibility,
): Promise<JoinGroupResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, status: "error", error: "You need to be logged in." };
  }

  const { data: existingMember } = await supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (existingMember) {
    return { ok: true, status: "already" };
  }

  if (visibility === "public") {
    const { error: insertError } = await supabase
      .from("group_members")
      .insert({ group_id: groupId, user_id: user.id, role: "member" });
    if (insertError) {
      return { ok: false, status: "error", error: friendlyError(insertError.message) };
    }
    revalidatePath("/groups");
    revalidatePath(`/groups/${groupId}`);
    return { ok: true, status: "joined" };
  }

  const { data: existingRequest } = await supabase
    .from("group_join_requests")
    .select("id, status")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingRequest?.status === "pending") {
    return { ok: true, status: "already" };
  }

  const { error: upsertError } = await supabase
    .from("group_join_requests")
    .upsert(
      { group_id: groupId, user_id: user.id, status: "pending", responded_at: null },
      { onConflict: "group_id,user_id" },
    );
  if (upsertError) {
    return { ok: false, status: "error", error: friendlyError(upsertError.message) };
  }

  return { ok: true, status: "requested" };
}

export interface RespondToJoinRequestResult {
  ok: boolean;
  error?: string;
}

/** The group owner approving or rejecting one pending request (Players
 * tab). Inserts the group_members row *before* flipping the request to
 * "approved" — the "owner adds a member whose join request they
 * approved" RLS policy accepts either 'pending' or 'approved', so either
 * order actually satisfies it, but this order means a failed second step
 * still leaves the membership granted rather than silently un-granting it. */
export async function respondToJoinRequestAction(
  requestId: string,
  decision: "approve" | "reject",
): Promise<RespondToJoinRequestResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "You need to be logged in." };
  }

  const { data: request, error: requestError } = await supabase
    .from("group_join_requests")
    .select("group_id, user_id, status")
    .eq("id", requestId)
    .maybeSingle();
  if (requestError || !request) {
    return { ok: false, error: friendlyError(requestError?.message ?? "Request not found.") };
  }
  if (request.status !== "pending") {
    return { ok: false, error: "That request was already responded to." };
  }

  if (decision === "approve") {
    const { error: memberError } = await supabase
      .from("group_members")
      .insert({
        group_id: request.group_id,
        user_id: request.user_id,
        role: "member",
      });
    if (memberError) {
      return { ok: false, error: friendlyError(memberError.message) };
    }
  }

  const { error: updateError } = await supabase
    .from("group_join_requests")
    .update({
      status: decision === "approve" ? "approved" : "rejected",
      responded_at: new Date().toISOString(),
    })
    .eq("id", requestId);
  if (updateError) {
    return { ok: false, error: friendlyError(updateError.message) };
  }

  revalidatePath(`/groups/${request.group_id}`);
  return { ok: true };
}

/**
 * Settings tab (owner-only): swaps the group's cover photo. Bound with the
 * group id via `.bind(null, groupId)` in SettingsPanel so it fits the same
 * `useActionState((prevState, formData) => …)` shape as createGroupAction —
 * the leading bound arg is just supplied ahead of the two useActionState
 * gives it. Reuses the exact validation/upload shape createGroupAction uses
 * for a brand-new group's cover; the storage bucket's own "group owners can
 * replace their group's cover" UPDATE policy (see the group-covers
 * migration) already covers overwriting an *existing* group's cover, not
 * just setting one at creation time, so no new storage policy is needed
 * here.
 */
export async function updateGroupCoverAction(
  groupId: string,
  _prevState: GroupActionState,
  formData: FormData,
): Promise<GroupActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be logged in." };
  }

  const coverImageFile = formData.get("coverImage");
  if (!(coverImageFile instanceof File) || coverImageFile.size === 0) {
    return { error: "Choose an image first." };
  }
  if (!(coverImageFile.type in COVER_IMAGE_EXTENSION_BY_TYPE)) {
    return { error: "Cover photo must be a PNG, JPEG, or WebP image." };
  }
  if (coverImageFile.size > COVER_IMAGE_MAX_BYTES) {
    return { error: "Cover photo must be 5MB or smaller." };
  }

  const extension = COVER_IMAGE_EXTENSION_BY_TYPE[coverImageFile.type];
  const path = `${groupId}/cover.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from("group-covers")
    .upload(path, coverImageFile, {
      contentType: coverImageFile.type,
      upsert: true,
    });
  if (uploadError) {
    return { error: friendlyError(uploadError.message) };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("group-covers").getPublicUrl(path);

  // Not "not the owner" specifically — RLS silently returns zero rows for
  // anyone whose update the "owners can update their own groups" policy
  // doesn't allow, same shape as every other owner-gated update in this
  // file — but the Settings tab is only ever rendered for the owner in the
  // first place, so this is a defensive fallback, not the expected path.
  const { data: updated, error: updateError } = await supabase
    .from("groups")
    // Cache-bust the URL (Diego might upload a differently-named file over
    // the same extension, e.g. swap a .png for a new .png) so <img> src
    // actually changes and the browser doesn't serve the stale cached one.
    .update({ cover_image_url: `${publicUrl}?v=${Date.now()}` })
    .eq("id", groupId)
    .select("id")
    .maybeSingle();
  if (updateError) {
    return { error: friendlyError(updateError.message) };
  }
  if (!updated) {
    return { error: "Only the group owner can update this." };
  }

  revalidatePath(`/groups/${groupId}`);
  revalidatePath("/groups");
  return { error: null };
}

export interface EndGroupResult {
  ok: boolean;
  error?: string;
}

/**
 * Settings tab (owner-only): permanently deletes the group. The "owners can
 * delete their own groups" RLS policy (initial schema migration) already
 * covers the authorization; group_members/group_join_requests/game_groups
 * all cascade off groups.id (on delete cascade — see their own migrations),
 * so members, pending requests, and this group's leaderboard tags are
 * cleaned up automatically. Logged games themselves are untouched — they
 * just stop being tagged to this (now-gone) group. Best-effort removal of
 * the cover photo from storage first, since that file lives outside the
 * cascade and would otherwise be orphaned; failing to clean it up doesn't
 * block ending the group.
 */
export async function endGroupAction(groupId: string): Promise<EndGroupResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "You need to be logged in." };
  }

  const { data: files } = await supabase.storage
    .from("group-covers")
    .list(groupId);
  if (files && files.length > 0) {
    await supabase.storage
      .from("group-covers")
      .remove(files.map((f) => `${groupId}/${f.name}`));
  }

  const { data: deleted, error } = await supabase
    .from("groups")
    .delete()
    .eq("id", groupId)
    .select("id")
    .maybeSingle();
  if (error) {
    return { ok: false, error: friendlyError(error.message) };
  }
  if (!deleted) {
    return { ok: false, error: "Only the group owner can end this group." };
  }

  revalidatePath("/groups");
  return { ok: true };
}

export interface TransferOwnershipResult {
  ok: boolean;
  error?: string;
}

/** Settings tab (owner-only): hands the group to another current member —
 * routed through the transfer_group_ownership() SECURITY DEFINER RPC (see
 * its migration) since this needs to change groups.owner_id to someone
 * OTHER than the caller and flip two group_members.role values together,
 * neither of which a plain client-side update can do under this schema's
 * existing RLS policies. */
export async function transferGroupOwnershipAction(
  groupId: string,
  newOwnerId: string,
): Promise<TransferOwnershipResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "You need to be logged in." };
  }

  const { error } = await supabase.rpc("transfer_group_ownership", {
    p_group_id: groupId,
    p_new_owner_id: newOwnerId,
  });
  if (error) {
    return { ok: false, error: friendlyError(error.message) };
  }

  revalidatePath(`/groups/${groupId}`);
  revalidatePath("/groups");
  return { ok: true };
}
