"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signInAction, signInWithGoogleAction } from "@/lib/auth-actions";
import { INITIAL_AUTH_STATE } from "@/lib/auth-action-state";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { GoogleIcon } from "@/components/GoogleIcon";

const inputClasses =
  "mt-1.5 w-full rounded-full border border-black/[.12] bg-white px-4 py-2 text-sm outline-none focus:border-zinc-400 dark:border-white/[.15] dark:bg-zinc-900";

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(
    signInAction,
    INITIAL_AUTH_STATE,
  );

  return (
    <div className="mt-8 space-y-6">
      <form action={signInWithGoogleAction}>
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-full border border-black/[.12] bg-white px-5 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-400 dark:border-white/[.15] dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-600"
        >
          <GoogleIcon />
          Continue with Google
        </button>
      </form>

      <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
        <div className="h-px flex-1 bg-black/[.08] dark:bg-white/[.145]" />
        or
        <div className="h-px flex-1 bg-black/[.08] dark:bg-white/[.145]" />
      </div>

      <form action={formAction} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className={inputClasses}
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="block text-sm font-medium">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-zinc-600 hover:underline dark:text-zinc-400"
            >
              Forgot password?
            </Link>
          </div>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className={inputClasses}
          />
        </div>

        <TurnstileWidget />

        {state.error && (
          <p className="text-sm text-red-600 dark:text-red-400">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-60 dark:hover:bg-[#ccc]"
        >
          {isPending ? "Logging in…" : "Log in"}
        </button>
      </form>
    </div>
  );
}
