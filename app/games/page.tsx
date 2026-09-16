import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Track your games — BOTChub",
};

/**
 * Entry point for Phase 7 — the chooser between the two logging forms
 * Diego asked for. Publicly viewable (like the rest of the site); the
 * cards themselves lead to /games/log/[mode], which is what actually
 * requires being signed in.
 */
export default async function GamesLandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold">Track your games</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Log a game you just played and build your own stats over time.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link
          href="/games/log/fast"
          className="group relative overflow-hidden rounded-2xl border border-black/[.08] p-6 transition-colors hover:border-zinc-400 dark:border-white/[.145] dark:hover:border-zinc-600"
        >
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-indigo-500/10 via-transparent to-transparent" />
          <div className="text-2xl">⚡</div>
          <div className="mt-3 font-semibold">Fast Log</div>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            The essentials — script, character, alignment, who won. About a
            minute.
          </p>
        </Link>

        <Link
          href="/games/log/detailed"
          className="group relative overflow-hidden rounded-2xl border border-black/[.08] p-6 transition-colors hover:border-zinc-400 dark:border-white/[.145] dark:hover:border-zinc-600"
        >
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-purple-500/10 via-transparent to-transparent" />
          <div className="text-2xl">🔍</div>
          <div className="mt-3 font-semibold">Detailed Log</div>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Everything in Fast Log, plus players, how far the game went, and
            more.
          </p>
        </Link>
      </div>

      {user ? (
        <Link
          href="/games/history"
          className="mt-6 inline-block text-sm font-medium text-zinc-600 hover:underline dark:text-zinc-400"
        >
          View your logged games →
        </Link>
      ) : (
        <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
          <Link href="/login" className="font-medium underline">
            Sign in
          </Link>{" "}
          to start logging games.
        </p>
      )}
    </main>
  );
}
