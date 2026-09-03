import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "@/lib/auth-actions";
import { DisplayNameForm } from "./DisplayNameForm";
import { ProfileDetailsForm } from "./ProfileDetailsForm";

export const metadata = {
  title: "Account — botchub",
};

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: profile }, { data: privateInfo }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, tag, avatar_url, country, region")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("profile_private")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Account</h1>

      <div className="mt-8 flex items-center gap-4 rounded-2xl border border-black/[.08] p-5 dark:border-white/[.145]">
        {profile?.avatar_url ? (
          // External avatar URL from the OAuth provider — not worth a
          // remotePatterns entry for one small profile-page image.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatar_url}
            alt=""
            className="h-12 w-12 shrink-0 rounded-full"
          />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-black/[.06] text-lg font-semibold dark:bg-white/[.08]">
            {(profile?.display_name ?? user.email ?? "?").charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <div className="truncate font-medium">
            {profile?.display_name ? (
              <>
                {profile.display_name}
                <span className="text-zinc-500 dark:text-zinc-400">
                  #{profile.tag}
                </span>
              </>
            ) : (
              "botchub member"
            )}
          </div>
          <div className="truncate text-sm text-zinc-600 dark:text-zinc-400">
            {user.email}
          </div>
        </div>
      </div>

      <DisplayNameForm
        currentDisplayName={profile?.display_name ?? ""}
        currentTag={profile?.tag ?? null}
      />

      <ProfileDetailsForm
        defaultFullName={privateInfo?.full_name ?? ""}
        defaultCountry={profile?.country ?? ""}
        defaultRegion={profile?.region ?? ""}
      />

      <form action={signOutAction} className="mt-6">
        <button
          type="submit"
          className="w-full rounded-full border border-black/[.12] px-5 py-2.5 text-sm font-medium transition-colors hover:border-zinc-400 dark:border-white/[.15] dark:hover:border-zinc-600"
        >
          Log out
        </button>
      </form>
    </main>
  );
}
