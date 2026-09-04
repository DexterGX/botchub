"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const linkClasses =
  "block rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-black/[.04] dark:text-zinc-400 dark:hover:bg-white/[.06]";

/**
 * The header nav's hamburger menu, shown below the `sm` breakpoint in
 * place of the inline link row (that row reading "botchubScripts
 * Characters Account" run together on a phone-width screen was the actual
 * bug Diego flagged — there was no responsive handling on the header nav
 * at all before this).
 *
 * The dropdown itself stays a small `right-0`-anchored panel rather than a
 * full-screen modal like AvatarPicker's — at ~180px wide it can't run past
 * the edge of any phone screen the way a multi-column icon grid could, so
 * the anchored-dropdown clipping problem that motivated the modal there
 * doesn't apply here.
 */
export function MobileNav({ loggedIn }: { loggedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative sm:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? "Close menu" : "Open menu"}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-black/[.08] text-zinc-600 transition-colors hover:border-zinc-400 hover:text-zinc-900 dark:border-white/[.145] dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-50"
      >
        {open ? <CloseIcon /> : <HamburgerIcon />}
      </button>

      {open && (
        <nav className="absolute right-0 top-full z-50 mt-2 w-44 rounded-xl border border-black/[.12] bg-white p-1.5 shadow-lg dark:border-white/[.15] dark:bg-zinc-900">
          <Link
            href="/scripts"
            onClick={() => setOpen(false)}
            className={linkClasses}
          >
            Scripts
          </Link>
          <Link
            href="/characters"
            onClick={() => setOpen(false)}
            className={linkClasses}
          >
            Characters
          </Link>
          {loggedIn ? (
            <Link
              href="/account"
              onClick={() => setOpen(false)}
              className={linkClasses}
            >
              Account
            </Link>
          ) : (
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className={linkClasses}
            >
              Log in
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}

function HamburgerIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M3 5.5h14M3 10h14M3 14.5h14" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
    </svg>
  );
}
