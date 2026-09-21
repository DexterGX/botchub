import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getScriptById } from "@/lib/queries";
import { EditScriptForm } from "./EditScriptForm";

export const metadata = {
  title: "Edit script — BOTChub",
};

interface EditScriptPageProps {
  params: Promise<{ id: string }>;
}

/** Diego's ask: make the browse table's Edit action actually do
 * something — a plain metadata-editing form (name/author/description/
 * notes/version/type/category/difficulty; doesn't touch the character
 * roster itself), with the delete-script action folded into it as a
 * danger zone rather than living as its own icon on /scripts (see
 * updateScriptAction/deleteScriptAction in lib/script-upload-actions.ts).
 * Owner-only, same gate as the RLS policies underneath: anyone else who
 * lands on this URL gets bounced back to the script's own page rather
 * than seeing a form they couldn't actually submit. */
export default async function EditScriptPage({ params }: EditScriptPageProps) {
  const { id } = await params;

  const script = await getScriptById(id);
  if (!script) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/scripts/${id}/edit`);
  if (script.owner_id !== user.id) redirect(`/scripts/${id}`);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <Link
        href={`/scripts/${id}`}
        className="text-sm text-zinc-600 hover:underline dark:text-zinc-400"
      >
        ← Back to script
      </Link>

      <h1 className="mt-4 text-3xl font-semibold tracking-tight">
        Edit script
      </h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Update this script&apos;s details. To change its actual character
        roster, upload the revised JSON as a new script instead.
      </p>

      <EditScriptForm script={script} />
    </main>
  );
}
