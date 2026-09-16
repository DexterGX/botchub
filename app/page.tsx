import Link from "next/link";
import { getRecentScripts } from "@/lib/queries";

const QUICK_ACTIONS = [
  {
    href: "/scripts",
    title: "Browse scripts",
    description: "Search the library by name, author, or character.",
    icon: "📜",
    disabled: false,
  },
  {
    href: "/characters",
    title: "Character reference",
    description: "Look up any Townsfolk, Outsider, Minion, or Demon.",
    icon: "🎭",
    disabled: false,
  },
  {
    href: "/scripts/new",
    title: "Upload a script",
    description: "Sign in to share your own custom script.",
    icon: "⬆️",
    disabled: false,
  },
  {
    href: "/games",
    title: "Track your games",
    description: "Log wins and losses and build your player stats.",
    icon: "🎲",
    disabled: false,
  },
  {
    href: "/grimoire",
    title: "Online grimoire",
    description:
      "Run a game live with a shared, real-time grimoire. Coming soon.",
    icon: "🕯️",
    disabled: true,
  },
  {
    href: "/groups",
    title: "Groups & leaderboards",
    description: "Track standings with your regular playgroup. Coming soon.",
    icon: "🏆",
    disabled: true,
  },
] as const;

export default async function Home() {
  const recentScripts = await getRecentScripts(6);

  return (
    <main className="flex flex-1 flex-col">
      <section className="border-b border-black/[.08] px-6 py-20 text-center dark:border-white/[.145]">
        <h1 className="mx-auto max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
          A better home for Blood on the Clocktower
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
          BOTChub is a community-run hub for Blood on the Clocktower — browse
          and upload custom scripts, look up any character, and track your
          games and stats. Free, no account needed to browse.
        </p>
      </section>

      <section className="mx-auto grid w-full max-w-5xl gap-4 px-6 py-14 sm:grid-cols-2 lg:grid-cols-3">
        {QUICK_ACTIONS.map((action) => {
          const cardClasses =
            "rounded-2xl border border-black/[.08] p-6 transition-colors dark:border-white/[.145]";
          const body = (
            <>
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">{action.icon}</span>
                <span className="font-semibold">{action.title}</span>
              </div>
              <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {action.description}
              </div>
            </>
          );

          return action.disabled ? (
            <div
              key={action.href}
              aria-disabled="true"
              className={`${cardClasses} cursor-not-allowed opacity-60`}
            >
              {body}
            </div>
          ) : (
            <Link
              key={action.href}
              href={action.href}
              className={`${cardClasses} hover:border-zinc-400 dark:hover:border-zinc-600`}
            >
              {body}
            </Link>
          );
        })}
      </section>

      <section className="mx-auto w-full max-w-5xl px-6 pb-20">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-semibold">Recently added</h2>
          <Link
            href="/scripts"
            className="text-sm font-medium text-zinc-600 hover:underline dark:text-zinc-400"
          >
            View all scripts →
          </Link>
        </div>

        {recentScripts.length === 0 ? (
          <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
            No scripts yet.
          </p>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recentScripts.map((script) => (
              <Link
                key={script.id}
                href={`/scripts/${script.id}`}
                className="rounded-2xl border border-black/[.08] p-5 transition-colors hover:border-zinc-400 dark:border-white/[.145] dark:hover:border-zinc-600"
              >
                <div className="font-semibold">{script.name}</div>
                <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  by {script.author ?? "Unknown"}
                  {script.description ? ` · ${script.description}` : ""}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
