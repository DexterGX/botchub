"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AuthActionState } from "@/lib/auth-action-state";

function friendlyError(message: string): string {
  return message || "Something went wrong. Please try again.";
}

/**
 * Builds this app's own origin from request headers rather than a hardcoded
 * env var, so email confirmation / OAuth redirect links are correct in
 * every environment (localhost, Vercel preview deploys, production)
 * without extra config. Vercel (and any proxy) sets x-forwarded-*.
 */
async function getOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function readCaptchaToken(formData: FormData): string | undefined {
  const token = String(formData.get("captchaToken") ?? "").trim();
  return token || undefined;
}

export async function signInAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
    options: { captchaToken: readCaptchaToken(formData) },
  });

  if (error) {
    return { error: friendlyError(error.message) };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signUpAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (password !== confirmPassword) {
    return { error: "Passwords don't match." };
  }

  const supabase = await createClient();
  const origin = await getOrigin();
  const { error, data } = await supabase.auth.signUp({
    email,
    password,
    options: {
      captchaToken: readCaptchaToken(formData),
      // /email-confirmed, not straight to "/" — see that page's own doc
      // comment. Landing on the homepage with no acknowledgment at all
      // was the actual bug being fixed here.
      emailRedirectTo: `${origin}/auth/callback?next=/email-confirmed`,
    },
  });

  if (error) {
    return { error: friendlyError(error.message) };
  }

  // With email confirmation required (the Supabase default), signUp()
  // succeeds but returns no session yet — send them to check their inbox
  // instead of straight to the homepage.
  if (!data.session) {
    redirect("/signup/check-email");
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function requestPasswordResetAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    return { error: "Enter your email address." };
  }

  const supabase = await createClient();
  const origin = await getOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
    captchaToken: readCaptchaToken(formData),
  });

  if (error) {
    return { error: friendlyError(error.message) };
  }

  // Supabase returns success here regardless of whether the address has an
  // account — intentionally not leaking which emails are registered.
  redirect("/forgot-password/check-email");
}

export async function updatePasswordAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (password !== confirmPassword) {
    return { error: "Passwords don't match." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "This reset link has expired. Request a new one." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: friendlyError(error.message) };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
