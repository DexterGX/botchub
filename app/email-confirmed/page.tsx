import Link from "next/link";

export const metadata = {
  title: "Email confirmed — BOTChub",
};

/**
 * Landing spot after clicking a signup confirmation email link — see
 * lib/auth-actions.ts's signUpAction (emailRedirectTo now points the
 * /auth/callback exchange's `next` param here instead of straight at "/")
 * and app/auth/callback/route.ts's own doc comment. Diego's report: the
 * confirm link used to bounce straight to the homepage with zero
 * acknowledgment that anything had just happened — this page exists
 * purely to say "yes, that worked" before sending them on.
 *
 * By the time this renders, /auth/callback has already exchanged the
 * code for a real session (its redirect response is what sets the
 * cookie), so the visitor is normally already logged in — "Continue to
 * BOTChub" just takes them into the app. The "Log in" link underneath is
 * the explicit fallback Diego asked for: the one case that session isn't
 * there is a confirmation link that was already consumed before the
 * visitor got to click it (a corporate email scanner or the mail
 * provider itself prefetching the link — Supabase's one-time code is
 * spent either way), which sends /auth/callback to /login?error=oauth
 * instead of here. This page doesn't need to tell those two cases apart:
 * either the visitor is already in and "Continue" just works, or they
 * aren't and "Log in" gets them the rest of the way with their new
 * password.
 */
export default function EmailConfirmedPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16 text-center">
      <div className="text-3xl">✅</div>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">
        Email confirmed
      </h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Your BOTChub account is active. You&apos;re good to go.
      </p>

      <Link
        href="/"
        className="mt-8 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
      >
        Continue to BOTChub
      </Link>

      <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
        Not signed in?{" "}
        <Link
          href="/login"
          className="font-medium text-foreground underline underline-offset-2"
        >
          Log in with your credentials
        </Link>
      </p>
    </main>
  );
}
