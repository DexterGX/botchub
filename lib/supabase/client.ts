import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for use in Client Components. Not used by any Phase 2
 * page yet (everything is server-rendered), but set up now for when
 * interactive/write features land in later phases.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
