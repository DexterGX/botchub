import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOfficialCharactersForFilter } from "@/lib/queries";
import { ScriptUploadForm } from "./ScriptUploadForm";

export const metadata = {
  title: "Upload a script — BOTChub",
};

export default async function NewScriptPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // A lean id/team/edition-only projection of the official character
  // library, handed to the client form so it can auto-detect Script Type
  // and Category the instant a file is chosen — without a round trip to
  // the server just to look up which ids are official. See
  // ScriptUploadForm.tsx's detectFromScriptJson for the heuristic itself.
  const officials = (await getOfficialCharactersForFilter()).map((c) => ({
    characterId: c.character_id,
    team: c.team,
    edition: c.edition,
  }));

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <Link
        href="/scripts"
        className="text-sm text-zinc-600 hover:underline dark:text-zinc-400"
      >
        ← All scripts
      </Link>

      <h1 className="mt-4 text-3xl font-semibold tracking-tight">
        Upload a script
      </h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Upload the script&apos;s JSON file — the same file
        script.bloodontheclocktower.com and other script tools export.
        We&apos;ll auto-fill what we can from it; everything stays editable
        before you submit. It&apos;s validated and saved straight to your
        account; no sign-up needed beyond being logged in.
      </p>

      <ScriptUploadForm officials={officials} />
    </main>
  );
}
