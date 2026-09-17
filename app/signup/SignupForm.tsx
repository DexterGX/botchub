"use client";

import { useActionState } from "react";
import { signUpAction } from "@/lib/auth-actions";
import { INITIAL_AUTH_STATE } from "@/lib/auth-action-state";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

const inputClasses =
  "mt-1.5 w-full rounded-full border border-black/[.12] bg-white px-4 py-2 text-sm outline-none focus:border-zinc-400 dark:border-white/[.15] dark:bg-zinc-900";

export function SignupForm() {
  const [state, formAction, isPending] = useActionState(
    signUpAction,
    INITIAL_AUTH_STATE,
  );

  return (
    <div className="mt-8 space-y-6">
      <GoogleSignInButton />

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
          <label htmlFor="password" className="block text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className={inputClasses}
          />
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            At least 8 characters.
          </p>
        </div>

        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-sm font-medium"
          >
            Confirm password
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className={inputClasses}
          />
        </div>

        <TurnstileWidget resetSignal={state} />

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
          {isPending ? "Creating account…" : "Create account"}
        </button>

        <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
          By creating an account you agree this is an unofficial, fan-made
          community project, not affiliated with The Pandemonium Institute.
        </p>
      </form>
    </div>
  );
}
