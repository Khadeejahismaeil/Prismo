"use client";

import { useEffect, useState } from "react";

/** The Chromium beforeinstallprompt event (not in the standard TS lib). */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "prismo:install-dismissed";

/**
 * Subtle, dismissible "install to home screen" pill. Uses the native
 * beforeinstallprompt flow on Chromium; on iOS (which has no such event) it
 * shows the manual Share → "Add to Home Screen" hint. Hidden when the app is
 * already running standalone, or once dismissed.
 */
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) return;
    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      /* ignore */
    }

    const ua = window.navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
    if (ios) {
      setIsIOS(true);
      setShow(true);
      return;
    }

    const onPrompt = (e: Event) => {
      e.preventDefault(); // stop Chrome's mini-infobar; we show our own
      setDeferred(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const dismiss = () => {
    setShow(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    try {
      await deferred.userChoice;
    } catch {
      /* ignore */
    }
    setDeferred(null);
    dismiss();
  };

  if (!show) return null;

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 z-50 flex justify-center px-3"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
    >
      <div className="glass-strong screen-enter pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl px-3.5 py-2.5 shadow-lg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="" width={34} height={34} className="shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold text-[var(--ink)]">Install Prismo</p>
          <p className="truncate text-[12px] text-[var(--ink-soft)]">
            {isIOS ? "Tap Share, then “Add to Home Screen”" : "Add it to your home screen"}
          </p>
        </div>
        {isIOS ? (
          <button onClick={dismiss} className="press shrink-0 rounded-full bg-[var(--ink)] px-3 py-1.5 text-[12.5px] font-bold text-white">
            Got it
          </button>
        ) : (
          <button
            onClick={install}
            className="press shrink-0 rounded-full px-3.5 py-1.5 text-[12.5px] font-bold text-white"
            style={{ backgroundImage: "var(--grad-primary)" }}
          >
            Install
          </button>
        )}
        <button onClick={dismiss} aria-label="Dismiss" className="press shrink-0 text-[var(--ink-faint)]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
