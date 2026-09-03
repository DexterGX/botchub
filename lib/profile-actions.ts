"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ProfileActionState } from "@/lib/profile-action-state";

function friendlyError(message: string): string {
  return message || "Something went wrong. Please try again.";
}

/**
 * One combined submit for the onboarding form: the required display name
 * (via the set_display_name() SQL function, which owns the "find an
 * unused 4-digit tag" retry loop) plus the optional real name / location
 * fields. Always lands on the homepage afterward — this is the one-time
 * "finish setting up your account" step, not a general profile editor
 * (see updateProfileDetailsAction / setDisplayNameAction below for that).
 */
export async function completeOnboardingAction(
  _prevState: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  const displayName = String(formData.get("displayName") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const country = String(formData.get("country") ?? "").trim();
  const region = String(formData.get("region") ?? "").trim();

  if (!displayName) {
    return { error: "Enter a display name." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be logged in." };
  }

  const { error: nameError } = await supabase.rpc("set_display_name", {
    p_display_name: displayName,
  });
  if (nameError) {
    return { error: friendlyError(nameError.message) };
  }

  if (country || region) {
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ country: country || null, region: region || null })
      .eq("id", user.id);
    if (profileError) {
      return { error: friendlyError(profileError.message) };
    }
  }

  if (fullName) {
    // upsert, not update: an account created before profile_private
    // existed (or, for any account, before its first save here) has no
    // row yet — a plain update() would silently affect zero rows.
    const { error: privateError } = await supabase
      .from("profile_private")
      .upsert({ id: user.id, full_name: fullName }, { onConflict: "id" });
    if (privateError) {
      return { error: friendlyError(privateError.message) };
    }
  }

  revalidatePath("/", "layout");
  redirect("/");
}

/**
 * Renames (or, called again with the same name, "rerolls" the tag on) the
 * account page. Thin wrapper around set_display_name() — same function
 * onboarding uses, since a rename is just "assign me a new name + tag"
 * either way.
 */
export async function setDisplayNameAction(
  _prevState: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  const displayName = String(formData.get("displayName") ?? "").trim();

  if (!displayName) {
    return { error: "Enter a display name." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be logged in." };
  }

  const { error } = await supabase.rpc("set_display_name", {
    p_display_name: displayName,
  });
  if (error) {
    return { error: friendlyError(error.message) };
  }

  revalidatePath("/", "layout");
  redirect("/account");
}

/** Account-page edit for the optional fields: real name (private table),
 * country + region (public profiles table). */
export async function updateProfileDetailsAction(
  _prevState: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const country = String(formData.get("country") ?? "").trim();
  const region = String(formData.get("region") ?? "").trim();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be logged in." };
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ country: country || null, region: region || null })
    .eq("id", user.id);
  if (profileError) {
    return { error: friendlyError(profileError.message) };
  }

  // upsert, not update: same reasoning as completeOnboardingAction above.
  const { error: privateError } = await supabase
    .from("profile_private")
    .upsert(
      { id: user.id, full_name: fullName || null },
      { onConflict: "id" }
    );
  if (privateError) {
    return { error: friendlyError(privateError.message) };
  }

  revalidatePath("/", "layout");
  redirect("/account");
}
