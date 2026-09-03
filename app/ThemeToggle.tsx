"use client";

import { useSyncExternalStore } from "react";

// document.documentElement's class list is state React doesn't own (the
// beforeInteractive script in the root layout sets it before hydration,
// and toggle() below mutates it directly). useSyncExternalStore is the
// React-recommended way to read state like that without a hydration
// mismatch: it renders getServerSnapshot's value (null — "not yet known")
// for both the server render and the first client render so they match,
// then swaps to getSnapshot's real value right after. A useEffect that
// calls setState to do the same thing works too, but trips the
// react-hooks/set-state-in-effect lint rule this project enforces.
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

function getSnapshot() {
  return document.documentElement.classList.contains("dark");
}

function getServerSnapshot() {
  return null;
}

/**
 * The inline script in the root layout applies the right class (light or
 * dark) before first paint, using localStorage("theme") if the visitor has
 * picked one, falling back to the OS preference otherwise. This component
 * is just the button: it reads the class the inline script already set (so
 * there's nothing to flash), and on click flips both the DOM class and the
 * stored preference. Kept intentionally dumb — no theme "state machine",
 * no context provider — since only this one button ever needs to know the
 * current theme.
 */
export function ThemeToggle() {
  const isDark = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  function toggle() {
    const next = !isDark;
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // Private browsing / storage disabled — the toggle still works for
      // this page load, it just won't be remembered next visit.
    }
  }

  if (isDark === null) {
    return (
      <span
        aria-hidden="true"
        className="h-9 w-9 shrink-0 rounded-full border border-black/[.08] dark:border-white/[.145]"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/[.08] text-zinc-600 transition-colors hover:border-zinc-400 hover:text-zinc-900 dark:border-white/[.145] dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-50"
    >
      {isDark ? (
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-4 w-4"
          aria-hidden="true"
        >
          <path d="M10 3a1 1 0 011 1v1a1 1 0 11-2 0V4a1 1 0 011-1zm0 12a4 4 0 100-8 4 4 0 000 8zm7-5a1 1 0 110 2h-1a1 1 0 110-2h1zM4 10a1 1 0 01-1 1H2a1 1 0 110-2h1a1 1 0 011 1zm11.657-5.657a1 1 0 010 1.414l-.707.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM6.464 14.95a1 1 0 010 1.414l-.707.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zm9.193 1.414a1 1 0 01-1.414 0l-.707-.707a1 1 0 111.414-1.414l.707.707a1 1 0 010 1.414zM5.757 5.757a1 1 0 01-1.414 0l-.707-.707A1 1 0 014.05 3.636l.707.707a1 1 0 010 1.414zM10 17a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1z" />
        </svg>
      ) : (
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-4 w-4"
          aria-hidden="true"
        >
          <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
        </svg>
      )}
    </button>
  );
}
