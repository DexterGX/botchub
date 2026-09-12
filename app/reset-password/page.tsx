import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata = {
  title: "Set a new password — BOTChub",
};

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">
        Set a new password
      </h1>

      {user ? (
        <>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Choose a new password for {user.email}.
          </p>
          <ResetPasswordForm />
        </>
      ) : (
        <>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            This reset link is invalid or has expired.
          </p>
          <Link
            href="/forgot-password"
            className="mt-6 rounded-full bg-foreground px-5 py-2.5 text-center text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
          >
            Request a new link
          </Link>
        </>
      )}
    </main>
  );
}
