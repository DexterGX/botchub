"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signOutAction } from "@/lib/auth-actions";

/**
 * Replaces the desktop header's plain "Account" link with a dropdown —
 * Diego asked for clicking it to offer "Settings" and "Logout" instead of
 * jumping straight to /account. "Settings" still points at /account (the
 * only account/profile page that exists), so this is purely a navigation
 * affordance change, not a new route.
 *
 * Same outside-click/Escape-to-close pattern as MobileNav's hamburger
 * dropdown, kept here as its own small component since this one only ever
 * renders on >=sm (MobileNav already covers <sm with its own "Account" +
 * "Log out" entries).
 */
export function AccountMenu() {
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
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-1 hover:text-foreground"
      >
        Account
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          <path d="M5 7.5l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <nav
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-40 rounded-xl border border-black/[.12] bg-white p-1.5 shadow-lg dark:border-white/[.15] dark:bg-zinc-900"
        >
          {/* Two links instead of one "Settings" — /account's own <lg
              layout now shows exactly one section at a time (Overview or
              Profile details, picked via ?tab=), the same split MobileNav's
              hamburger offers below `sm`. Without this, a tablet-width
              visitor (>=sm, <lg — where this dropdown, not the hamburger,
              is what's shown) would have no way to reach Profile details
              at all. */}
          <Link
            href="/account?tab=overview"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-black/[.04] dark:text-zinc-400 dark:hover:bg-white/[.06]"
          >
            Overview
          </Link>
          <Link
            href="/account?tab=profile"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-black/[.04] dark:text-zinc-400 dark:hover:bg-white/[.06]"
          >
            Profile details
          </Link>
          <div className="my-1 border-t border-black/[.08] dark:border-white/[.1]" />
          <form action={signOutAction}>
            <button
              type="submit"
              role="menuitem"
              className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-zinc-600 hover:bg-black/[.04] dark:text-zinc-400 dark:hover:bg-white/[.06]"
            >
              Logout
            </button>
          </form>
        </nav>
      )}
    </div>
  );
}
