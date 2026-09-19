import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyGroups } from "@/lib/queries";
import { GroupCard } from "./components/GroupCard";

export const metadata = {
  title: "Your groups — BOTChub",
};

/** The Groups landing page — Diego's spec: "the program should open to a
 * Groups page, where users can see the groups they are part of, as
 * cards", with buttons to join or create a group. Requires an account,
 * same as /games — a signed-out visitor is sent to /login rather than
 * shown an empty state, since group membership is inherently tied to an
 * account. */
export default async function GroupsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const groups = await getMyGroups(user.id);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Your groups</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Track standings with your regular playgroup.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/groups/join"
            className="rounded-full bg-gradient-to-r from-teal-500 to-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
          >
            Join a group
          </Link>
          <Link
            href="/groups/new"
            className="rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
          >
            + Create a group
          </Link>
        </div>
      </div>

      {groups.length === 0 ? (
        <p className="mt-10 text-sm text-zinc-600 dark:text-zinc-400">
          You&apos;re not in any groups yet — join one with an invite code,
          browse public groups, or start your own.
        </p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <GroupCard key={group.id} group={group} />
          ))}
        </div>
      )}
    </main>
  );
}
