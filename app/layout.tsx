import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "botchub — Blood on the Clocktower scripts",
  description:
    "A community site for Blood on the Clocktower custom scripts, characters, and stats.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
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
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50" suppressHydrationWarning>
        <header className="border-b border-black/[.08] dark:border-white/[.145]">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              botchub
            </Link>
            <nav className="flex items-center gap-6 text-sm font-medium text-zinc-600 dark:text-zinc-400">
              <Link href="/scripts" className="hover:text-foreground">
                Scripts
              </Link>
              <Link href="/characters" className="hover:text-foreground">
                Characters
              </Link>
            </nav>
          </div>
        </header>

        <div className="flex flex-1 flex-col">{children}</div>

        <footer className="border-t border-black/[.08] dark:border-white/[.145]">
          <div className="mx-auto w-full max-w-5xl px-6 py-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
            botchub is an unofficial, fan-made community project and is not
            affiliated with or endorsed by The Pandemonium Institute.
            Blood on the Clocktower is a trademark of The Pandemonium Institute.
          </div>
        </footer>
      </body>
    </html>
  );
}
