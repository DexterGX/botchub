import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyGamesPage } from "@/lib/queries";
import { GameHistoryCard } from "@/app/games/components/GameHistoryCard";

export const metadata = {
  title: "My games — BOTChub",
};

interface HistoryPageProps {
  searchParams: Promise<{ logged?: string; page?: string }>;
}

export default async function GamesHistoryPage({
  searchParams,
}: HistoryPageProps) {
  const { logged, page: pageParam } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const page = Math.max(1, Number(pageParam) || 1);
  const { games, totalCount, totalPages } = await getMyGamesPage(
    user.id,
    page,
  );

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">My games</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {totalCount} game{totalCount === 1 ? "" : "s"} logged
          </p>
        </div>
        <Link
          href="/games"
          className="shrink-0 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
        >
          + Log a game
        </Link>
      </div>

      {logged === "1" && (
        <div className="mt-6 rounded-2xl border border-emerald-600/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-400">
          Game logged 🎉
        </div>
      )}

      {games.length === 0 ? (
        <p className="mt-10 text-sm text-zinc-600 dark:text-zinc-400">
          No games logged yet —{" "}
          <Link href="/games" className="font-medium underline">
            log your first one
          </Link>
          .
        </p>
      ) : (
        <ul className="mt-8 space-y-3">
          {games.map((game) => (
            <GameHistoryCard key={game.id} game={game} />
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-4 text-sm">
          {page > 1 ? (
            <Link
              href={`/games/history?page=${page - 1}`}
              className="rounded-full border border-black/[.12] px-4 py-2 font-medium transition-colors hover:border-zinc-400 dark:border-white/[.15] dark:hover:border-zinc-600"
            >
              ← Prev
            </Link>
          ) : (
            <span className="cursor-not-allowed rounded-full border border-black/[.12] px-4 py-2 font-medium text-zinc-400 dark:border-white/[.15] dark:text-zinc-600">
              ← Prev
            </span>
          )}

          <span className="text-zinc-500 dark:text-zinc-400">
            Page {page} of {totalPages}
          </span>

          {page < totalPages ? (
            <Link
              href={`/games/history?page=${page + 1}`}
              className="rounded-full border border-black/[.12] px-4 py-2 font-medium transition-colors hover:border-zinc-400 dark:border-white/[.15] dark:hover:border-zinc-600"
            >
              Next →
            </Link>
          ) : (
            <span className="cursor-not-allowed rounded-full border border-black/[.12] px-4 py-2 font-medium text-zinc-400 dark:border-white/[.15] dark:text-zinc-600">
              Next →
            </span>
          )}
        </div>
      )}
    </main>
  );
}
