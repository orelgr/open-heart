// PWA install support: platform + "already installed" detection and the Android/desktop install prompt.
// Imported from main.jsx so `beforeinstallprompt` is captured even if it fires before React mounts.
import { useEffect, useState } from "react";

const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;

/** "ios" (iPhone/iPad, incl. iPadOS that reports as a Mac) | "android" | "desktop". */
export const platform = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  ? "ios"
  : /Android/.test(ua)
    ? "android"
    : "desktop";

/** Opened from the home-screen icon (installed app), not a browser tab. */
export const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(display-mode: standalone)").matches ||
    window.matchMedia?.("(display-mode: fullscreen)").matches ||
    window.matchMedia?.("(display-mode: minimal-ui)").matches ||
    navigator.standalone === true);

let deferred = null; // the saved beforeinstallprompt event (Chrome / Edge / Samsung Internet)
let installed = false;
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // keep our own sheet instead of the browser's mini-infobar
    deferred = e;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installed = true;
    emit();
  });
}

/** Shows the browser's native install dialog. Resolves "accepted" | "dismissed" | "unavailable". */
export async function promptInstall() {
  if (!deferred) return "unavailable";
  const e = deferred;
  deferred = null; // the event can only be used once
  emit();
  e.prompt();
  const { outcome } = await e.userChoice.catch(() => ({ outcome: "dismissed" }));
  if (outcome === "accepted") installed = true;
  emit();
  return outcome;
}

const AUTO_KEY = "oh-install-auto-shown";
/** The auto sheet opens once per browser session after sign-in; closing it with X keeps it closed. */
export const autoShown = () => {
  try {
    return sessionStorage.getItem(AUTO_KEY) === "1";
  } catch {
    return false;
  }
};
export const markAutoShown = () => {
  try {
    sessionStorage.setItem(AUTO_KEY, "1");
  } catch {
    /* private mode: it just may show again */
  }
};

export function useInstall() {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    listeners.add(fn);
    const mq = window.matchMedia?.("(display-mode: standalone)");
    mq?.addEventListener?.("change", fn);
    return () => {
      listeners.delete(fn);
      mq?.removeEventListener?.("change", fn);
    };
  }, []);
  const standalone = isStandalone() || installed;
  return {
    platform,
    standalone,
    canPrompt: !!deferred,
    /** Whether to offer installing at all: never inside the app; on desktop only where the browser supports it. */
    offer: !standalone && (platform !== "desktop" || !!deferred),
  };
}
