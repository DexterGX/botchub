"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const DEBOUNCE_MS = 400;

/**
 * The main "Search by script name or description…" box, split out of the
 * plain GET <form> below it (which still owns every other filter — Author,
 * Game, Include/Exclude characters, Order By — via the Filter button) so
 * this one field alone can apply itself a moment after typing stops,
 * instead of requiring a visible Filter click. Feedback Diego got
 * ("Cant find scrits via search") was most likely just this: the filters
 * only ever took effect once Filter was clicked or Enter pressed, and
 * plenty of people never notice a "Filter" button below a search box at
 * all.
 *
 * Deliberately debounced (400ms after the last keystroke) rather than
 * pushing a new URL on every keystroke — this still keeps the URL as the
 * one source of truth (bookmarkable, shareable, back-button-friendly), it
 * just updates via `router.replace` (no history entry per keystroke, no
 * full page reload) instead of a native form submit. Client component
 * state — this input's own value — survives that replace because the
 * route doesn't change, only its search params do, so the box never loses
 * focus while someone's still typing.
 *
 * Still a real `name="q"` field inside the surrounding <form> (see
 * ScriptsPage): a no-JS visitor, or anyone who clicks Filter/presses Enter
 * before the debounce fires, gets the exact same result through the
 * form's own native submission — this is purely an additional, faster
 * path to the same place, not a replacement for it.
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
      // A new search term invalidates whatever page you were on.
      params.delete("page");
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
      placeholder="Search by script name or description…"
      className="w-full rounded-full border border-black/[.12] bg-white px-5 py-3 text-sm outline-none focus:border-zinc-400 dark:border-white/[.15] dark:bg-zinc-900"
    />
  );
}

/** ScriptsPage already reads its own `searchParams` prop, which forces the
 * whole route to render dynamically — so this Suspense boundary isn't
 * covering for a real static-prerender build failure the way MobileNav's
 * does. It's here anyway, matching this hook's own recommended pattern, as
 * cheap insurance against that ever changing. Same markup as the real
 * input (uncontrolled, no value) so there's no visible swap once it
 * mounts. */
export function SearchBoxFallback({ initialValue }: { initialValue: string }) {
  return (
    <input
      type="search"
      name="q"
      defaultValue={initialValue}
      placeholder="Search by script name or description…"
      className="w-full rounded-full border border-black/[.12] bg-white px-5 py-3 text-sm outline-none focus:border-zinc-400 dark:border-white/[.15] dark:bg-zinc-900"
    />
  );
}
