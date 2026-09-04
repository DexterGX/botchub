"use client";

import { useActionState, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { setAvatarAction } from "@/lib/profile-actions";
import { INITIAL_PROFILE_STATE } from "@/lib/profile-action-state";
import { TEAM_LABELS, type Character, type Team } from "@/lib/types";

/**
 * "Change token" opens a real modal, rendered through a portal straight
 * into document.body, instead of an anchored dropdown.
 *
 * The dropdown version was `absolute`-positioned relative to its trigger
 * button. That's what caused two different clipping bugs Diego ran into:
 * an ancestor's `overflow-hidden` cutting it off (the header card's
 * gradient wash, fixed in Phase 3 follow-up #3), and — still present
 * after that fix — the panel's own fixed width running past the edge of
 * a narrow (phone-width) viewport, since it was anchored to a button
 * near the left edge of a ~340px-wide card with nowhere to grow into. A
 * centered, portal-rendered modal has neither problem: it isn't
 * positioned relative to anything on the page, so no ancestor can clip
 * it and no anchor point constrains which direction it can open in.
 */
export function AvatarPicker({
  charactersByTeam,
  currentCharacterId,
}: {
  charactersByTeam: { team: Team; characters: Character[] }[];
  currentCharacterId: string | null;
}) {
  const [state, formAction, isPending] = useActionState(
    setAvatarAction,
    INITIAL_PROFILE_STATE,
  );
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);

    // Lock background scroll while the modal is up — otherwise a long
    // character grid on a short phone screen scrolls the page underneath
    // it instead of just the grid itself.
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
        disabled={isPending}
        className="text-xs font-medium text-zinc-600 hover:underline disabled:opacity-60 dark:text-zinc-400"
      >
        {isPending ? "Saving…" : "🖼️ Change token"}
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => setOpen(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="flex max-h-[80vh] w-full max-w-sm flex-col overflow-hidden rounded-xl border border-black/[.12] bg-white shadow-xl dark:border-white/[.15] dark:bg-zinc-900"
            >
              {/* Not closed on submit — a failed setAvatarAction returns an
                  error into `state` without redirecting, and the modal
                  needs to stay open for that error to be visible. A
                  successful save calls redirect() server-side, which
                  navigates and remounts this component with open reset
                  to false, closing it naturally. */}
              <form action={formAction} className="flex min-h-0 flex-1 flex-col">
                <div className="flex items-center justify-between border-b border-black/[.08] p-3 dark:border-white/[.1]">
                  <span className="text-sm font-semibold">Pick a token</span>
                  <div className="flex items-center gap-3">
                    {currentCharacterId && (
                      <button
                        type="submit"
                        name="characterId"
                        value=""
                        className="rounded-full px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-black/[.04] dark:text-zinc-400 dark:hover:bg-white/[.06]"
                      >
                        Use default
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      aria-label="Close"
                      className="rounded-full p-1 text-zinc-500 hover:bg-black/[.04] dark:text-zinc-400 dark:hover:bg-white/[.06]"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-3">
                  {charactersByTeam.map((group) => (
                    <div key={group.team} className="mb-3">
                      <div className="px-1 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-600">
                        {TEAM_LABELS[group.team]}
                      </div>
                      <div className="grid grid-cols-6 gap-1.5">
                        {group.characters.map((c) => (
                          <button
                            key={c.id}
                            type="submit"
                            name="characterId"
                            value={c.character_id}
                            title={c.name}
                            disabled={isPending}
                            className={`flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border transition-colors disabled:opacity-60 ${
                              currentCharacterId === c.character_id
                                ? "border-foreground"
                                : "border-transparent hover:border-zinc-400 dark:hover:border-zinc-600"
                            }`}
                          >
                            {c.icon_url ? (
                              <Image
                                src={c.icon_url}
                                alt={c.name}
                                width={40}
                                height={40}
                                className="h-10 w-10 object-contain"
                              />
                            ) : (
                              <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-600">
                                {c.name.slice(0, 1)}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {state.error && (
                  <p className="border-t border-black/[.08] p-3 text-xs text-red-600 dark:border-white/[.1] dark:text-red-400">
                    {state.error}
                  </p>
                )}
              </form>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
