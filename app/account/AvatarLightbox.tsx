"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Wraps the small avatar circle shown on /account with a click target
 * that opens a bigger version in a centered, portal-rendered modal — same
 * pattern AvatarPicker already uses (escapes any ancestor's
 * overflow-hidden, and isn't anchored to a trigger that could run off a
 * narrow phone screen). `trigger`/`large` are passed in as ready-made
 * JSX rather than an image URL, since the small circle already has to
 * handle three different cases (a character token, an OAuth avatar_url,
 * or a plain initial-letter fallback) — this component doesn't need to
 * know which one it's showing, just render whatever it's given, bigger.
 */
export function AvatarLightbox({
  trigger,
  large,
  alt,
}: {
  trigger: ReactNode;
  large: ReactNode;
  alt: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`View ${alt} larger`}
        className="block rounded-full transition-opacity hover:opacity-90"
      >
        {trigger}
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
            onClick={() => setOpen(false)}
          >
            {/* No square card behind this — just the circle itself
                (already given a solid, opaque fill by the `large` content
                passed in, rather than the small trigger circle's faint
                `bg-black/[.06]` tint) directly against the dark backdrop. */}
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative"
            >
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white text-zinc-600 shadow-md hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                ✕
              </button>
              {large}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
