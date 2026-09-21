"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const DEBOUNCE_MS = 400;

/** Every param this form owns and re-derives on each change — `q` is
 * SearchBox's own independent mechanism (see its comment) and just passes
 * through untouched here. */
const OWNED_PARAMS = ["team", "edition"];

/**
 * Wraps /characters' Team and Edition selects — same shape as /scripts'
 * AutoApplyFilterForm (see that file's own comment for the full reasoning),
 * brought over here per Diego's ask that the Characters filters get "the
 * same changes we made from the scripts page": picking a value applies
 * itself immediately instead of requiring a separate Filter button click.
 *
 * A single `onChange` on the `<form>` itself catches both selects. Same
 * debounce-then-`router.replace` shape as SearchBox: the URL stays the one
 * source of truth (bookmarkable, shareable, back-button-friendly).
 *
 * Still a real `<form action="/characters" method="get">` underneath, for a
 * no-JS visitor — the visually-hidden submit button below exists only so
 * the browser still treats Enter-in-a-text-field as "submit this form".
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

      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, DEBOUNCE_MS);
  }

  return (
    <form
      ref={formRef}
      action="/characters"
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
