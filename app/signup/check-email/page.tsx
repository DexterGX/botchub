import Link from "next/link";

export const metadata = {
  title: "Check your email — botchub",
};

export default function SignupCheckEmailPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16 text-center">
      <div className="text-3xl">📬</div>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">
        Check your email
      </h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        We sent a confirmation link to the address you signed up with. Click it
        to activate your account.
      </p>
      <Link
        href="/"
        className="mt-8 rounded-full border border-black/[.12] px-5 py-2 text-sm font-medium transition-colors hover:border-zinc-400 dark:border-white/[.15] dark:hover:border-zinc-600"
      >
        Back to botchub
      </Link>
    </main>
  );
}
