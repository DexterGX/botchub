"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const DEBOUNCE_MS = 400;

/**
 * /characters' "Search by name or ability…" box — same debounce-then-
 * `router.replace` behavior as /scripts' SearchBox (see that file's own
 * comment for the full reasoning), brought over here per Diego's ask that
 * the Characters filters get "the same changes we made from the scripts
 * page": typing (or picking Team/Edition, via AutoApplyFilterForm) applies
 * itself a moment after you stop, instead of requiring a separate Filter
 * button click.
 *
 * Still a real `name="q"` field inside the surrounding <form> (see
 * CharactersPage): a no-JS visitor, or anyone who presses Enter before the
 * debounce fires, gets the exact same result through the form's own native
 * submission.
 */
export function SearchBox({ initialValue }: { initialValue: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialValue);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  function handleChange(next: string) {
    setValue(next);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (next.trim()) {
        params.set("q", next);
      } else {
        params.delete("q");
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, DEBOUNCE_MS);
  }

  return (
    <input
      type="search"
      name="q"
      value={value}
      onChange={(e) => handleChange(e.target.value)}
      placeholder="Search by name or ability…"
      className="w-full rounded-full border border-black/[.12] bg-white px-4 py-2 text-sm outline-none focus:border-zinc-400 dark:border-white/[.15] dark:bg-zinc-900"
    />
  );
}

/** Same uncontrolled-input fallback pattern as /scripts' SearchBoxFallback —
 * cheap insurance against the `useSearchParams` Suspense requirement ever
 * mattering for a route that's already forced dynamic by reading its own
 * `searchParams` prop. Identical markup to the real input so there's no
 * visible swap once it mounts. */
export function SearchBoxFallback({ initialValue }: { initialValue: string }) {
  return (
    <input
      type="search"
      name="q"
      defaultValue={initialValue}
      placeholder="Search by name or ability…"
      className="w-full rounded-full border border-black/[.12] bg-white px-4 py-2 text-sm outline-none focus:border-zinc-400 dark:border-white/[.15] dark:bg-zinc-900"
    />
  );
}
