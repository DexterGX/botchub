import Link from "next/link";
import type { LikedScriptRow } from "@/lib/queries";
import { truncate } from "@/lib/types";
import { DifficultyStars } from "@/components/DifficultyStars";
import { LikeButton } from "@/app/scripts/LikeButton";

/** Account page's new Favorites tab (Diego's ask) — every script the
 * signed-in user has liked (❤️), newest-liked first. `initialLiked` is
 * always true and `isLoggedIn` always true here (this tab only ever
 * renders for the signed-in user looking at their own favorites) —
 * unliking a card from here removes it from the list on the *next* visit
 * (LikeButton's own optimistic toggle still flips it visually right away,
 * same as everywhere else it's used, it just doesn't also animate the
 * card out of this particular list mid-session). */
export function FavoriteScripts({ scripts }: { scripts: LikedScriptRow[] }) {
  return (
    <div className="max-w-2xl">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Favorite scripts
      </h2>

      {scripts.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          Scripts you like (❤️) show up here —{" "}
          <Link href="/scripts" className="font-medium underline">
            browse the library
          </Link>
          .
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {scripts.map((script) => (
            <li
              key={script.id}
              className="rounded-2xl border border-black/[.08] p-4 dark:border-white/[.145]"
            >
              <div className="flex items-start justify-between gap-3">
                <Link
                  href={`/scripts/${script.id}`}
                  className="font-medium hover:underline"
                >
                  {script.name}{" "}
                  <span className="font-normal text-zinc-500 dark:text-zinc-500">
                    v{script.version}
                  </span>
                </Link>
                <LikeButton
                  scriptId={script.id}
                  initialLiked={true}
                  initialCount={script.like_count}
                  isLoggedIn={true}
                />
              </div>

              {script.description && (
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {truncate(script.description, 120)}
                </p>
              )}

              <div className="mt-2 flex items-center justify-between gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                <span>by {script.author ?? "Unknown"}</span>
                <DifficultyStars difficulty={script.difficulty} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
