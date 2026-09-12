import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignupForm } from "./SignupForm";

export const metadata = {
  title: "Sign up — BOTChub",
};

export default async function SignupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/");

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">
        Create an account
      </h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Already have one?{" "}
        <Link
          href="/login"
          className="font-medium text-foreground underline underline-offset-2"
        >
          Log in
        </Link>
      </p>

      <SignupForm />
    </main>
  );
}
