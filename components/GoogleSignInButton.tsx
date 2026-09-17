"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type GoogleCredentialResponse = {
  credential: string;
};

type GoogleIdConfiguration = {
  client_id: string;
  callback: (response: GoogleCredentialResponse) => void;
  use_fedcm_for_prompt?: boolean;
};

type GoogleButtonConfiguration = {
  type?: "standard" | "icon";
  theme?: "outline" | "filled_blue" | "filled_black";
  size?: "large" | "medium" | "small";
  shape?: "rectangular" | "pill" | "circle" | "square";
  text?: "signin_with" | "signup_with" | "continue_with" | "signin";
  logo_alignment?: "left" | "center";
  width?: number;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: GoogleIdConfiguration) => void;
          renderButton: (
            parent: HTMLElement,
            options: GoogleButtonConfiguration,
          ) => void;
        };
      };
    };
  }
}

// Google requires an explicit pixel width (no "100%"/responsive option) and
// clamps whatever's passed to this range itself — matched here so a
// measured container width never gets silently overridden.
const MIN_BUTTON_WIDTH = 200;
const MAX_BUTTON_WIDTH = 400;
const RESIZE_DEBOUNCE_MS = 150;

/**
 * "Continue with Google", via Google Identity Services' own button plus an
 * ID token (supabase.auth.signInWithIdToken), instead of the old
 * signInWithGoogleAction() server action, which used
 * supabase.auth.signInWithOAuth() to redirect the browser through
 * https://<project-ref>.supabase.co/auth/v1/callback on its way to Google.
 * That redirect is exactly what made Google's account picker show
 * "to continue to <project-ref>.supabase.co" instead of botchub.com — an
 * alarming, unrecognizable domain for a visitor who's never heard of
 * Supabase (real feedback we got). This flow authenticates entirely on
 * this page instead — no redirect through Supabase at all — so the picker
 * shows "to continue to botchub.com".
 *
 * Trade-off: the button is now rendered by Google inside a cross-origin
 * iframe, so it can't be restyled with Tailwind the way the old custom
 * button (GoogleIcon + text, in components/GoogleIcon.tsx, now unused)
 * was — `theme`/`shape`/`size` below are the extent of what Google's API
 * exposes. Width is measured off the container on mount and on resize,
 * since Google only accepts a fixed pixel width rather than "100%".
 *
 * Needs NEXT_PUBLIC_GOOGLE_CLIENT_ID set (browser-readable, hence the
 * NEXT_PUBLIC_ prefix) to the Client ID of the OAuth 2.0 client created in
 * the correct Google Cloud project — the same value already used server
 * side in Supabase's Google provider settings.
 */
export function GoogleSignInButton() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  const handleCredentialResponse = useCallback(
    async (response: GoogleCredentialResponse) => {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: response.credential,
      });

      if (error) {
        router.push("/login?error=oauth");
        return;
      }

      // router.refresh() re-runs Server Components (the header's
      // logged-in state, in particular) against the session cookie the
      // browser client above just set — a plain push() alone can leave
      // the old "Log in" header showing, same reason the server actions
      // in lib/auth-actions.ts call revalidatePath() before redirecting.
      router.push("/");
      router.refresh();
    },
    [router],
  );

  const renderButton = useCallback(() => {
    const container = containerRef.current;
    if (!container || !window.google) return;

    const width = Math.min(
      MAX_BUTTON_WIDTH,
      Math.max(MIN_BUTTON_WIDTH, container.offsetWidth || MIN_BUTTON_WIDTH),
    );
    // Clear before re-rendering (on resize) so the old iframe doesn't just
    // sit there next to the new one.
    container.innerHTML = "";
    window.google.accounts.id.renderButton(container, {
      type: "standard",
      theme: "outline",
      size: "large",
      shape: "pill",
      logo_alignment: "left",
      text: "continue_with",
      width,
    });
  }, []);

  const handleScriptLoad = useCallback(() => {
    if (!window.google || initializedRef.current) return;

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      // Fails soft (no button, rest of the form still works) rather than
      // throwing — most likely to happen locally before .env.local has
      // been filled in with the new client's ID.
      console.error(
        "NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set — Google sign-in is disabled.",
      );
      return;
    }

    initializedRef.current = true;
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: handleCredentialResponse,
      use_fedcm_for_prompt: true,
    });
    renderButton();
  }, [handleCredentialResponse, renderButton]);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    function handleResize() {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(renderButton, RESIZE_DEBOUNCE_MS);
    }
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [renderButton]);

  return (
    <>
      {/* onReady, not onLoad: the GSI script tag is shared/deduped across
          the app by next/script, so after visiting one auth page the
          script is already loaded by the time this component mounts on
          the other (e.g. /signup -> /login). onLoad only fires the first
          time the script itself loads, so on that second page it would
          silently never fire and leave this button missing until a full
          reload force-reloaded the script from scratch. onReady is next/
          script's own documented tool for this — it re-fires on every
          mount, including when the script was already loaded by an
          earlier page. */}
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onReady={handleScriptLoad}
      />
      <div ref={containerRef} className="flex w-full justify-center" />
    </>
  );
}
