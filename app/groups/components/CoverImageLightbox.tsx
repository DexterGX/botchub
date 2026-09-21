"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Diego's ask (2026-09-21): let people click a group's cover photo to see
 * it full-size, on the group detail page. Renders the banner itself (same
 * height/width/object-cover treatment the caller passes in) as the click
 * target, then opens an uncropped, `object-contain` version in a centered
 * modal — same portal/Escape/scroll-lock pattern as AvatarLightbox on
 * /account, just for a rectangular banner instead of a circular avatar,
 * so this doesn't force AvatarLightbox's `rounded-full` trigger shape onto
 * a banner image.
 */
export function CoverImageLightbox({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className: string;
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
        aria-label={`View ${alt || "group cover photo"} larger`}
        className="block w-full rounded-2xl transition-opacity hover:opacity-90"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- user-supplied URL */}
        <img src={src} alt={alt} className={className} />
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
            onClick={() => setOpen(false)}
          >
            <div onClick={(e) => e.stopPropagation()} className="relative">
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white text-zinc-600 shadow-md hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                ✕
              </button>
              {/* eslint-disable-next-line @next/next/no-img-element -- user-supplied URL */}
              <img
                src={src}
                alt={alt}
                className="max-h-[85vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl"
              />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
