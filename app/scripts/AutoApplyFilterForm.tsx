"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const DEBOUNCE_MS = 400;

/** Every param this form owns and re-derives on each change — `q` (the
 * search box) and `page` are deliberately excluded: `q` is SearchBox's
 * own independent mechanism (see its comment) and just passes through
 * untouched here, and `page` is always dropped since any filter change
 * invalidates whatever page you were on. */
const OWNED_PARAMS = ["author", "type", "include", "exclude", "difficulty", "sort"];

/**
 * Wraps every /scripts filter control except the search box (which
 * already applies itself the same way — see SearchBox's own comment) —
 * Author, Game, Include/Exclude characters, Difficulty, and the mobile
 * Order By select. Diego's ask: apply the same "just start typing/
 * picking and it filters" behavior the search box already has to every
 * other control, instead of requiring a separate "Filter" button click.
 *
 * A single `onChange` on the `<form>` itself catches every field inside
 * it — including CharacterFilterDropdown's checkboxes, several DOM levels
 * down (React's synthetic onChange bubbles the same as any native DOM
 * event) — so no per-field wiring is needed here or in those components.
 * Same debounce-then-`router.replace` shape as SearchBox: the URL stays
 * the one source of truth (bookmarkable, shareable, back-button-friendly)
 * and nothing about routing changes, it just doesn't wait for a click.
 *
 * Still a real `<form action="/scripts" method="get">` underneath, for a
 * no-JS visitor or anyone who presses Enter before the debounce fires —
 * the visually-hidden submit button below exists only so the browser
 * still treats Enter-in-a-text-field as "submit this form" (it won't,
 * with more than one text field present, unless some submit control
 * exists — see MDN's "implicit submission"), not because Diego wants a
 * visible Filter button back.
 */
export function AutoApplyFilterForm({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  function handleChange() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      const form = formRef.current;
      if (!form) return;
      const formData = new FormData(form);

      // Start from whatever's already in the URL — preserves `q` — then
      // overwrite every param this form actually owns.
      const params = new URLSearchParams(searchParams.toString());
      for (const key of OWNED_PARAMS) params.delete(key);
      for (const [key, value] of formData.entries()) {
        if (!OWNED_PARAMS.includes(key)) continue;
        const str = String(value).trim();
        if (str) params.append(key, str);
      }
      params.delete("page");

      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, DEBOUNCE_MS);
  }

  return (
    <form
      ref={formRef}
      action="/scripts"
      method="get"
      onChange={handleChange}
      className={className}
    >
      {children}
      <button type="submit" className="sr-only">
        Apply filters
      </button>
    </form>
  );
}
