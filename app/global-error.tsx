"use client";

/**
 * Catches an uncaught error in the root layout itself (app/layout.tsx —
 * e.g. its own `supabase.auth.getUser()` call failing), which app/error.tsx
 * can't cover since that layout sits *above* error.tsx's boundary, not
 * inside it. Rare in practice, but per Next's own docs this is the one
 * gap a plain error.tsx never closes, and it's what would otherwise leave
 * a visitor looking at a totally blank white screen with literally no
 * working link or button anywhere on it. Must define its own <html>/
 * <body> — it replaces the root layout entirely while active, so none of
 * layout.tsx's header/nav/fonts are available here.
 */
export default function GlobalError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6 text-center text-zinc-900 dark:bg-black dark:text-zinc-50">
        <h1 className="text-2xl font-semibold">Something went wrong</h1>
        <p className="mt-2 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
          BOTChub hit an unexpected error loading this page. Trying again
          usually clears it up.
        </p>
        <button
          type="button"
          onClick={() => retry()}
          className="mt-6 rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
