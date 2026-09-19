import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPublicGroups, getMyGroups } from "@/lib/queries";
import { JoinByCodeSearch } from "@/app/groups/components/JoinByCodeSearch";
import { JoinGroupButton } from "@/app/groups/components/JoinGroupButton";
import { SearchForm, SearchFormFallback } from "./SearchForm";

export const metadata = {
  title: "Join a group — BOTChub",
};

interface JoinPageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function JoinGroupPage({ searchParams }: JoinPageProps) {
  const { q } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [publicGroups, myGroups] = await Promise.all([
    getPublicGroups({ q }),
    getMyGroups(user.id),
  ]);
  const myGroupIds = new Set(myGroups.map((g) => g.id));

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold">Join a group</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Browse public groups or look one up by its ID#.
      </p>

      <div className="mt-8">
        <JoinByCodeSearch />
      </div>

      <div className="mt-8">
        <h2 className="font-semibold">Browse public groups</h2>
        <div className="mt-3">
          <Suspense fallback={<SearchFormFallback initialQuery={q ?? ""} />}>
            <SearchForm initialQuery={q ?? ""} />
          </Suspense>
        </div>

        {publicGroups.length === 0 ? (
          <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
            {q ? "No public groups matched that search." : "No public groups yet."}
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {publicGroups.map((group) => (
              <li
                key={group.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-black/[.08] p-4 dark:border-white/[.145]"
              >
                <div className="min-w-0">
                  <div className="font-medium">{group.name}</div>
                  {group.description && (
                    <p className="truncate text-sm text-zinc-600 dark:text-zinc-400">
                      {group.description}
                    </p>
                  )}
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-500">
                    {group.member_count} member
                    {group.member_count === 1 ? "" : "s"} · ID# {group.invite_code}
                  </p>
                </div>
                <JoinGroupButton
                  groupId={group.id}
                  visibility="public"
                  initialStatus={myGroupIds.has(group.id) ? "member" : "none"}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
