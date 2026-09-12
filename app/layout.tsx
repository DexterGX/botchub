import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeToggle } from "./ThemeToggle";
import { MobileNav } from "./MobileNav";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

// Applied before hydration (see the beforeInteractive <Script> below) so
// the visitor's chosen theme — or their OS preference, if they've never
// touched the toggle — is in place for the very first paint. Without this,
// switching globals.css from the prefers-color-scheme strategy to a class
// strategy (needed so the toggle can override the OS setting) would cause
// a flash of the wrong theme on every load.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("theme");
    var isDark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (isDark) document.documentElement.classList.add("dark");
  } catch (e) {}
})();
`;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BOTChub — Blood on the Clocktower scripts",
  description:
    "A community site for Blood on the Clocktower custom scripts, characters, and stats.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      {/*
        suppressHydrationWarning here (and on <html> above) isn't hiding a
        real bug — it tells React not to warn when THIS element's own
        attributes differ between server and client render. Some browser
        extensions (security/anti-phishing tools are the usual culprit)
        inject attributes like bis_skin_checked/bis_register into the DOM
        right after the page loads, before React hydrates, which otherwise
        trips React's hydration-mismatch warning even though nothing is
        actually broken. See: https://react.dev/link/hydration-mismatch
      */}
      <body
        className="min-h-full flex flex-col bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50"
        suppressHydrationWarning
      >
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
        />
        <header className="border-b border-black/[.08] dark:border-white/[.145]">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              BOTChub
            </Link>

            {/* >=sm: the full inline link row, unchanged. Below sm there
                isn't room for "botchub" plus every link on one line (that
                crowding — "botchubScripts Characters Account" running
                together with no space to wrap — was the actual bug), so a
                hamburger replaces the links there instead of letting them
                wrap or shrink to illegibility. */}
            <nav className="hidden items-center gap-4 text-sm font-medium text-zinc-600 dark:text-zinc-400 sm:flex sm:gap-6">
              <Link href="/scripts" className="hover:text-foreground">
                Scripts
              </Link>
              <Link href="/characters" className="hover:text-foreground">
                Characters
              </Link>
              {user ? (
                <Link href="/account" className="hover:text-foreground">
                  Account
                </Link>
              ) : (
                <Link href="/login" className="hover:text-foreground">
                  Log in
                </Link>
              )}
              <ThemeToggle />
            </nav>

            <div className="flex items-center gap-2 sm:hidden">
              <ThemeToggle />
              <MobileNav loggedIn={!!user} />
            </div>
          </div>
        </header>

        <div className="flex flex-1 flex-col">{children}</div>

        <footer className="border-t border-black/[.08] dark:border-white/[.145]">
          <div className="mx-auto w-full max-w-5xl px-6 py-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
            BOTChub is an unofficial, fan-made community project and is not
            affiliated with or endorsed by The Pandemonium Institute. Blood on
            the Clocktower is a trademark of The Pandemonium Institute.
          </div>
        </footer>
      </body>
    </html>
  );
}
