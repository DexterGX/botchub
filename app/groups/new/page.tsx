import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CreateGroupForm } from "@/app/groups/components/CreateGroupForm";

export const metadata = {
  title: "Create a group — BOTChub",
};

export default async function NewGroupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold">Create a group</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Set up a leaderboard for your regular playgroup.
      </p>

      <div className="mt-8">
        <CreateGroupForm />
      </div>
    </main>
  );
}
