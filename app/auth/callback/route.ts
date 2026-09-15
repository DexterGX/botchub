import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Single landing spot after: a Google OAuth sign-in, clicking a signup
 * confirmation email link, or clicking a password-reset email link. All
 * three end up here with a `code` param (Supabase's PKCE flow) that gets
 * exchanged for a real session — the code verifier needed to do that
 * exchange lives in a cookie this same browser already has, set when the
 * original signUp()/signInWithOAuth()/resetPasswordForEmail() call ran.
 *
 * `next` decides where to send the visitor afterward: "/" for OAuth,
 * "/email-confirmed" for signup confirmation (a real landing page now,
 * not a silent bounce straight to the homepage — see that page's own doc
 * comment), "/reset-password" for the recovery flow so they can set a new
 * password while this freshly-exchanged session is active.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Without this, the root layout's cached "Log in" header (rendered
      // before this session existed) can keep showing after the redirect —
      // same reason signInAction/signOutAction call this before redirecting.
      revalidatePath("/", "layout");
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth`);
}
