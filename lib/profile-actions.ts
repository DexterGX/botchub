"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ProfileActionState } from "@/lib/profile-action-state";

function friendlyError(message: string): string {
  return message || "Something went wrong. Please try again.";
}

/** Matches profile_private.referral_source's check constraint (see
 * supabase/migrations/20260917010000_profile_referral_source.sql) — kept
 * here rather than in lib/types.ts since, unlike ScriptType/Team/etc, this
 * enum is only ever read by the one onboarding form and this one action. */
const REFERRAL_SOURCES = ["clocktower_con", "discord", "friends", "other"] as const;
type ReferralSource = (typeof REFERRAL_SOURCES)[number];

function parseReferralSource(value: string): ReferralSource | null {
  return (REFERRAL_SOURCES as readonly string[]).includes(value)
    ? (value as ReferralSource)
    : null;
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
  formData: FormData,
): Promise<ProfileActionState> {
  const displayName = String(formData.get("displayName") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const birthday = String(formData.get("birthday") ?? "").trim();
  const country = String(formData.get("country") ?? "").trim();
  const region = String(formData.get("region") ?? "").trim();
  const referralSource = parseReferralSource(
    String(formData.get("referralSource") ?? "").trim(),
  );
  // Only ever meaningful (and only ever saved) alongside "other" — see
  // parseReferralSource's doc comment and the migration's own note.
  const referralSourceOther =
    referralSource === "other"
      ? String(formData.get("referralSourceOther") ?? "").trim()
      : "";

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

  const privateFields: Record<string, string> = {};
  if (fullName) privateFields.full_name = fullName;
  if (birthday) privateFields.birthday = birthday;
  if (referralSource) privateFields.referral_source = referralSource;
  if (referralSourceOther) privateFields.referral_source_other = referralSourceOther;

  if (Object.keys(privateFields).length > 0) {
    // upsert, not update: an account created before profile_private
    // existed (or, for any account, before its first save here) has no
    // row yet — a plain update() would silently affect zero rows. Only
    // the fields actually filled in are included in the payload, same as
    // the fullName-only version of this before — Google OAuth prefills
    // full_name via handle_new_user, so leaving a field blank here must
    // never clobber it (or a birthday/referral answer from a prior
    // attempt) back to null.
    const { error: privateError } = await supabase
      .from("profile_private")
      .upsert({ id: user.id, ...privateFields }, { onConflict: "id" });
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
  formData: FormData,
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

/** Account-page edit for the optional fields: real name + birthday (private
 * table), country + region (public profiles table). */
export async function updateProfileDetailsAction(
  _prevState: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const birthday = String(formData.get("birthday") ?? "").trim();
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
      { id: user.id, full_name: fullName || null, birthday: birthday || null },
      { onConflict: "id" },
    );
  if (privateError) {
    return { error: friendlyError(privateError.message) };
  }

  revalidatePath("/", "layout");
  redirect("/account");
}

/**
 * Sets (or clears, when characterId is empty) the token art the user has
 * chosen as their avatar. avatar_character_id has no database foreign key
 * (see the migration's comment — the natural reference target only has a
 * partial unique index), so this is the one place standing between a
 * visitor and writing an arbitrary string into that column: look the id up
 * against the real, official character list before saving anything.
 */
export async function setAvatarAction(
  _prevState: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const characterId = String(formData.get("characterId") ?? "").trim();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be logged in." };
  }

  if (characterId) {
    const { data: character, error: lookupError } = await supabase
      .from("characters")
      .select("character_id")
      .eq("character_id", characterId)
      .eq("is_homebrew", false)
      .maybeSingle();
    if (lookupError) {
      return { error: friendlyError(lookupError.message) };
    }
    if (!character) {
      return { error: "That token isn't a recognized character." };
    }
  }

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_character_id: characterId || null })
    .eq("id", user.id);
  if (error) {
    return { error: friendlyError(error.message) };
  }

  revalidatePath("/", "layout");
  redirect("/account");
}
