"use client";

import { useState, type ReactNode } from "react";

interface AccountTab {
  id: string;
  label: string;
  description?: string;
  content: ReactNode;
}

/**
 * The >=lg desktop layout: a left identity/nav column plus a right content
 * pane, similar in spirit to how GitHub's profile and Riot's account
 * management page are laid out. Client-only because the active tab is
 * local UI state with no reason to round-trip the server (nothing here
 * needs a shareable URL yet) — everything it renders was itself built as
 * server-rendered JSX in page.tsx and just passed down as props/content,
 * so the forms inside (DisplayNameForm, ProfileDetailsForm, AvatarPicker)
 * stay exactly as they already were.
 */
export function AccountDesktopShell({
  sidebarHeader,
  tabs,
  sidebarFooter,
  initialTabId,
}: {
  sidebarHeader: ReactNode;
  tabs: AccountTab[];
  sidebarFooter?: ReactNode;
  /** page.tsx's own `activeTab` (derived from `?tab=`) — this component
   * is otherwise all client-side state with no URL syncing (see the doc
   * comment above), so without this the desktop layout always opened on
   * the first tab no matter which one a link (the header's Account
   * dropdown, MobileNav) actually pointed at. Bug Diego caught
   * (2026-09-22): clicking "Favorites" or "Profile details" landed on
   * Overview every time. */
  initialTabId?: string;
}) {
  const [activeId, setActiveId] = useState(initialTabId ?? tabs[0]?.id);
  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0];

  return (
    <div className="mx-auto flex w-full max-w-5xl items-start gap-10 px-6 py-16">
      <aside className="w-64 shrink-0">
        {sidebarHeader}

        <nav className="mt-6 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveId(tab.id)}
              aria-current={tab.id === active?.id}
              className={`block w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                tab.id === active?.id
                  ? "bg-black/[.06] text-foreground dark:bg-white/[.08]"
                  : "text-zinc-600 hover:bg-black/[.04] dark:text-zinc-400 dark:hover:bg-white/[.05]"
              }`}
            >
              {tab.label}
              {tab.description && (
                <span className="mt-0.5 block text-xs font-normal text-zinc-500 dark:text-zinc-500">
                  {tab.description}
                </span>
              )}
            </button>
          ))}
        </nav>

        {sidebarFooter && <div className="mt-6">{sidebarFooter}</div>}
      </aside>

      <main className="min-w-0 flex-1">{active?.content}</main>
    </div>
  );
}
