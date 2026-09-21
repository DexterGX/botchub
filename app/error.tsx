"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Route-segment error boundary — every page under the root layout
 * ({children} in app/layout.tsx) falls back to this on an uncaught
 * client-side render error, instead of the crash bubbling past the root
 * layout entirely (there was no error.tsx anywhere in the app before
 * this, so that's exactly what used to happen — see
 * node_modules/next/dist/docs/.../error-handling.md's "errors propagate
 * to the nearest parent error boundary, or crash the whole app if there
 * isn't one").
 *
 * Diego's report (2026-09-21): trying to log out from the upload screen
 * "just bugs and asks me to reload the page" instead of logging out. The
 * header (with the Log out button) lives in the root layout, a sibling of
 * {children}, not inside it — so without this boundary, any uncaught
 * error thrown while rendering a page's content could take the entire
 * app down, header included, leaving no working Log out button to click
 * at all. With this in place, a page-content crash now shows this
 * fallback in place of just that page, while the header — and Log
 * out — keeps working. (This doesn't rule out a separate, one-off cause:
 * a Server Action call made just after a `next dev` restart or a fresh
 * deploy can fail with a stale-reference error until the page is
 * reloaded once — that's a normal Next.js dev/deploy artifact, not an
 * app bug, and isn't something this boundary needs to paper over.)
 */
export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 py-20 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        This page hit an unexpected error. Trying again usually clears it
        up — the rest of the site, including your account menu, is still
        working.
      </p>
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={() => retry()}
          className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-full border border-black/[.12] px-5 py-2 text-sm font-medium transition-colors hover:border-zinc-400 dark:border-white/[.15] dark:hover:border-zinc-600"
        >
          Go home
        </Link>
      </div>
    </main>
  );
}
