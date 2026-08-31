import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase client for use in Server Components, Route Handlers, and Server
 * Actions. Phase 2 only ever reads public data (no auth yet), but this
 * follows the standard @supabase/ssr cookie-forwarding pattern now so Phase 3
 * (auth) can drop in without changing every call site.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component that can't set cookies (no
            // active response, e.g. during static rendering). Safe to
            // ignore as long as middleware refreshes the session — which
            // will matter starting Phase 3, not Phase 2.
          }
        },
      },
    }
  );
}
