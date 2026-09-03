import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./OnboardingForm";

export const metadata = {
  title: "Set up your profile — botchub",
};

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: privateInfo }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, country, region")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("profile_private")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  // Already set up (e.g. they navigated here manually) — nothing to do.
  if (profile?.display_name) redirect("/");

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">
        Set up your profile
      </h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Pick a display name to finish creating your botchub account.
      </p>

      <OnboardingForm
        defaultFullName={privateInfo?.full_name ?? ""}
        defaultCountry={profile?.country ?? ""}
        defaultRegion={profile?.region ?? ""}
      />
    </main>
  );
}
