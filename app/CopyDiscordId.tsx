"use client";

import { useState } from "react";

/**
 * Diego's follow-up ask (2026-09-21): make the Discord ID on the homepage
 * clickable so it auto-copies, instead of visitors having to select the
 * text by hand. `page.tsx` itself is a Server Component (it awaits
 * getRecentScripts), so the click handler + clipboard call needed to move
 * into their own small Client Component rather than living inline there.
 */
export function CopyDiscordId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be denied (permissions, insecure context,
      // older browsers) — the ID is still plain selectable text underneath
      // the button, so there's nothing else to do here.
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title="Click to copy"
      className="rounded font-mono underline decoration-dotted underline-offset-2 hover:text-foreground"
    >
      {copied ? "Copied!" : id}
    </button>
  );
}
