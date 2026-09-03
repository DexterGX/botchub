import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./LoginForm";

export const metadata = {
  title: "Log in — botchub",
};

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/");

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Log in</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        New to botchub?{" "}
        <Link
          href="/signup"
          className="font-medium text-foreground underline underline-offset-2"
        >
          Create an account
        </Link>
      </p>

      <LoginForm />
    </main>
  );
}
