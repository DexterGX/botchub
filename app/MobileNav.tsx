"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { signOutAction } from "@/lib/auth-actions";

const linkClasses =
  "block rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-black/[.04] dark:text-zinc-400 dark:hover:bg-white/[.06]";

const activeLinkClasses =
  "block rounded-lg px-3 py-2 text-sm font-medium bg-black/[.06] text-foreground dark:bg-white/[.08]";

const logoutButtonClasses =
  "block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-zinc-600 hover:bg-black/[.04] dark:text-zinc-400 dark:hover:bg-white/[.06]";

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
 *
 * Signed-in visitors also get a "Log out" entry below a divider — the
 * desktop header has never had one either (sign-out has only ever lived on
 * /account), but on mobile the hamburger is the one place a signed-in
 * visitor can always reach, so it's the natural spot for it.
 */
export function MobileNav({ loggedIn }: { loggedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const onAccountPage = pathname === "/account";
  const activeAccountTab = searchParams.get("tab") === "profile" ? "profile" : "overview";

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
        className="flex h-11 w-11 items-center justify-center rounded-full border border-black/[.08] text-zinc-600 transition-colors hover:border-zinc-400 hover:text-zinc-900 dark:border-white/[.145] dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-50"
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
          <Link
            href="/games"
            onClick={() => setOpen(false)}
            className={linkClasses}
          >
            Games
          </Link>
          <Link
            href="/groups"
            onClick={() => setOpen(false)}
            className={linkClasses}
          >
            Groups
          </Link>
          {loggedIn ? (
            <>
              {/* Diego's ask: stop sending mobile straight to one long
                  crammed /account page — instead surface the same
                  Overview/Profile details split the >=lg sidebar already
                  has, as its own labeled group here, separate from the
                  Scripts/Characters/Games links above. */}
              <div className="my-1 border-t border-black/[.08] dark:border-white/[.1]" />
              <div className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-600">
                Account
              </div>
              <Link
                href="/account?tab=overview"
                onClick={() => setOpen(false)}
                aria-current={onAccountPage && activeAccountTab === "overview"}
                className={
                  onAccountPage && activeAccountTab === "overview"
                    ? activeLinkClasses
                    : linkClasses
                }
              >
                Overview
              </Link>
              <Link
                href="/account?tab=profile"
                onClick={() => setOpen(false)}
                aria-current={onAccountPage && activeAccountTab === "profile"}
                className={
                  onAccountPage && activeAccountTab === "profile"
                    ? activeLinkClasses
                    : linkClasses
                }
              >
                Profile details
              </Link>
            </>
          ) : (
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className={linkClasses}
            >
              Log in
            </Link>
          )}

          {loggedIn && (
            <>
              <div className="my-1 border-t border-black/[.08] dark:border-white/[.1]" />
              <form action={signOutAction}>
                <button type="submit" className={logoutButtonClasses}>
                  Log out
                </button>
              </form>
            </>
          )}
        </nav>
      )}
    </div>
  );
}

/**
 * `useSearchParams` (used above for the Account group's active-tab
 * highlighting) requires this Client Component to sit under a `<Suspense>`
 * boundary wherever it's rendered from a static page — see
 * node_modules/next/dist/docs/.../use-search-params.md's "Missing Suspense
 * boundary" note. Since MobileNav renders from the root layout (every
 * page on the site, not just /account), layout.tsx wraps it in
 * `<Suspense fallback={<MobileNavFallback />}>` rather than skip the
 * boundary and risk breaking every other static page's build. This
 * fallback is the closed-menu button alone, same size/position, so there's
 * no layout shift once the real component takes over.
 */
export function MobileNavFallback() {
  return (
    <div
      aria-hidden="true"
      className="flex h-11 w-11 items-center justify-center rounded-full border border-black/[.08] text-zinc-600 dark:border-white/[.145] dark:text-zinc-400 sm:hidden"
    >
      <HamburgerIcon />
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
      className="h-5 w-5"
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
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
    </svg>
  );
}
