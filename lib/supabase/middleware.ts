import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Paths a logged-in-but-not-yet-onboarded visitor is still allowed to
 * hit without being bounced to /onboarding — the onboarding flow itself,
 * the rest of the auth flow (so e.g. signing out or resetting a password
 * mid-onboarding still works), /email-confirmed (a brand-new signup lands
 * there straight out of /auth/callback, before onboarding has happened —
 * without this exemption this gate would bounce them straight past it to
 * /onboarding and they'd never see the "yes, that worked" page at all),
 * and anything that isn't a page (API routes, Next internals). */
function isOnboardingExempt(pathname: string): boolean {
  return (
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/email-confirmed") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next")
  );
}

/**
 * Refreshes the Supabase auth session on every request that matches the
 * root middleware's config, keeping request/response cookies in sync (the
 * standard @supabase/ssr middleware pattern — Server Components can only
 * read cookies, never write refreshed ones back). Also enforces the
 * "finish setting up your profile" gate: a signed-in visitor with no
 * display_name yet gets redirected to /onboarding from anywhere else on
 * the site, per Diego's "required — block until Display Name is set"
 * call. Signed-out visitors are completely unaffected — public browsing
 * still needs no account at all.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refreshes the token and must run before any other Supabase call in
  // this request. Reading the user (not just the session) also validates
  // the token against Supabase's servers instead of trusting an
  // unverified cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && !isOnboardingExempt(request.nextUrl.pathname)) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.display_name) {
      const redirectUrl = new URL("/onboarding", request.url);
      const redirectResponse = NextResponse.redirect(redirectUrl);
      // Carry over the refreshed session cookies onto the redirect too,
      // not just onto a "next" response — otherwise this redirect could
      // ship a stale/about-to-expire session cookie.
      supabaseResponse.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie);
      });
      return redirectResponse;
    }
  }

  return supabaseResponse;
}
