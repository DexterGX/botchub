import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { BulkUploadForm } from "./BulkUploadForm";

export const metadata = {
  title: "Bulk upload scripts — BOTChub",
};

/** /scripts/bulk-upload (Diego's ask, 2026-09-21) — a companion to
 * /scripts/new for someone who already has a folder of script JSON files
 * and wants to add them all in one go, rather than one at a time through
 * the single-file form. Same sign-in gate as /scripts/new, plus an admin
 * gate (Diego's ask, same day, on top of the feature going in) — see
 * lib/admin.ts. The actual per-file work happens in
 * bulkUploadScriptsAction (see lib/script-upload-actions.ts, which
 * re-checks admin itself) since every file needs its own
 * schema-validation + character-resolution pass — there's no bulk-insert
 * shortcut around that. */
export default async function BulkUploadScriptPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/scripts/bulk-upload");
  if (!(await isAdmin(supabase, user.id))) redirect("/scripts/new");

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <Link
        href="/scripts/new"
        className="text-sm text-zinc-600 hover:underline dark:text-zinc-400"
      >
        ← Back to single upload
      </Link>

      <h1 className="mt-4 text-3xl font-semibold tracking-tight">
        Bulk upload scripts
      </h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Choose every script JSON file you want to add at once. Each one
        needs to credit a name and an author in its own <code>_meta</code>{" "}
        — anything missing either gets skipped rather than guessed at, and
        you&apos;ll see exactly which files and why. Already-imported
        scripts (same name and author) are skipped too, so it&apos;s safe
        to re-run this over the same folder after fixing a few files.
      </p>

      <BulkUploadForm />
    </main>
  );
}
