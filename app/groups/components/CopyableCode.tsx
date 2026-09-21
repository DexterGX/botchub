"use client";

import { useState, type MouseEvent } from "react";

/** The "ID# XXXXX" pill, made click-to-copy — Diego's ask, so sharing a
 * group's code doesn't require carefully retyping it. Used both on the
 * group detail page's own header and on each /groups card, the latter
 * living inside GroupCard's outer `<Link>` — so this always stops
 * propagation/prevents default on click, harmless when there's no
 * enclosing link to interrupt. Briefly swaps its own text for "Copied!"
 * rather than showing a separate toast, since the pill itself is already
 * exactly where the user just clicked. */
export function CopyableCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function handleClick(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can throw (insecure context, permission denied) —
      // nothing to recover into here, the code is still plainly visible
      // in the pill's own text for a manual copy.
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title="Click to copy"
      className="shrink-0 rounded-full bg-black/[.06] px-2.5 py-0.5 text-xs font-medium tabular-nums text-zinc-600 transition-colors hover:bg-black/[.1] dark:bg-white/[.08] dark:text-zinc-400 dark:hover:bg-white/[.14]"
    >
      {copied ? "Copied!" : `ID# ${code}`}
    </button>
  );
}
