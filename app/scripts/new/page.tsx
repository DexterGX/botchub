import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
        Paste or upload the script&apos;s JSON — the same file
        script.bloodontheclocktower.com and other script tools export.
        It&apos;s validated and saved straight to your account; no sign-up
        needed
        beyond being logged in.
      </p>

      <ScriptUploadForm />
    </main>
  );
}
