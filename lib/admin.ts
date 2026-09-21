import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Whether the given signed-in user's profile is flagged admin —
 * `profiles.is_admin`, locked against self-grant by the
 * `profiles_lock_is_admin` trigger (see
 * supabase/migrations/20260921160000_profiles_add_is_admin.sql — the
 * column can only ever change via direct database access, never through
 * the app), so this check is safe to gate real functionality on.
 *
 * Diego's ask (2026-09-21): only /scripts/bulk-upload is admin-gated
 * right now — everything else on the site stays open to any signed-in
 * user. Checked both in that page (redirects a non-admin away) and in
 * bulkUploadScriptsAction itself (lib/script-upload-actions.ts), since a
 * page-level redirect alone wouldn't stop a direct Server Action call.
 */
export async function isAdmin(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle();
  return data?.is_admin === true;
}
