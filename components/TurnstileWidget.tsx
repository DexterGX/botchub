"use client";

import { useEffect, useId, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
        },
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";
let scriptLoadPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Turnstile"));
    document.head.appendChild(script);
  });

  return scriptLoadPromise;
}

/**
 * Cloudflare Turnstile — the bot check behind every password-based auth
 * form (signup, login, forgot-password). In "managed" mode it usually
 * renders nothing visible at all; Cloudflare's risk analysis only shows an
 * interactive challenge when a visitor looks suspicious. The resulting
 * token lands in a hidden "captchaToken" form field, so it rides along with
 * the normal <form> submit — no client-side fetch needed.
 *
 * Requires NEXT_PUBLIC_TURNSTILE_SITE_KEY. Pairs with CAPTCHA protection
 * turned on in the Supabase dashboard (Authentication → Attack Protection)
 * using the matching Turnstile secret key — Supabase verifies the token
 * server-side; this widget only produces it.
 */
export function TurnstileWidget({
  resetSignal,
}: {
  /** Bug fix (2026-09-15): a Turnstile token is single-use — Cloudflare
   * rejects a second verify attempt with the same token as
   * "timeout-or-duplicate". Supabase verifies the token as part of every
   * signInWithPassword/signUp/resetPasswordForEmail call, so once a
   * submit has gone through once (even one that then fails for an
   * unrelated reason, like a wrong password), the token sitting in the
   * hidden input is already spent — and since useActionState re-renders
   * this same mounted form rather than remounting it, the widget was
   * never getting a fresh one, so the *next* submit attempt always hit
   * this error regardless of whether the credentials were now correct.
   * Pass the enclosing form's action-state object here: the server action
   * returns a brand-new object on every call (even a repeat of the same
   * error message), so its identity changing is exactly the "a submit
   * just finished" signal this widget needs to fetch a fresh token. */
  resetSignal?: unknown;
} = {}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const inputId = useId();
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;
    let cancelled = false;

    loadTurnstileScript().then(() => {
      if (cancelled || !window.turnstile || !containerRef.current) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme: "auto",
        callback: (token) => {
          const input = document.getElementById(
            inputId,
          ) as HTMLInputElement | null;
          if (input) input.value = token;
        },
        "expired-callback": () => {
          const input = document.getElementById(
            inputId,
          ) as HTMLInputElement | null;
          if (input) input.value = "";
        },
      });
    });

    return () => {
      cancelled = true;
      if (window.turnstile && widgetIdRef.current) {
        window.turnstile.remove(widgetIdRef.current);
      }
    };
  }, [siteKey, inputId]);

  // Skip the very first render (resetSignal is just the form's initial
  // state then, not a completed submit) and reset on every change after
  // that — reset() re-runs verification and calls the same `callback`
  // above with a fresh token, so the hidden input is repopulated without
  // the visitor having to do anything.
  const isFirstRenderRef = useRef(true);
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }
    if (window.turnstile && widgetIdRef.current) {
      window.turnstile.reset(widgetIdRef.current);
    }
  }, [resetSignal]);

  if (!siteKey) {
    // Not configured yet (e.g. before Diego adds the env var locally) —
    // fail open so forms still work. This matches Supabase's own behavior:
    // captcha is only enforced once turned on in the dashboard, which
    // requires a real site key to exist in the first place.
    return null;
  }

  return (
    <div>
      <div ref={containerRef} />
      <input type="hidden" name="captchaToken" id={inputId} />
    </div>
  );
}
