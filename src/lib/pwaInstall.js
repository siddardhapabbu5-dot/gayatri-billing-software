/** Shared PWA install helpers — one deferred prompt for the whole app. */

let deferredPrompt = null;
const listeners = new Set();
let captureStarted = false;

function notify() {
  for (const fn of listeners) fn(deferredPrompt);
}

export function isStandaloneApp() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

export function isAppleTouchDevice() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent || "";
  if (/iphone|ipod|ipad/i.test(ua)) return true;
  return /macintosh/i.test(ua) && (window.navigator.maxTouchPoints || 0) > 1;
}

export function getDeferredInstallPrompt() {
  return deferredPrompt;
}

export function subscribeInstallPrompt(fn) {
  listeners.add(fn);
  fn(deferredPrompt);
  return () => listeners.delete(fn);
}

/**
 * Capture beforeinstallprompt once for the whole SPA.
 * Never unregister — multiple UI pieces share this (public + staff).
 */
export function initPwaInstallCapture() {
  if (typeof window === "undefined") return () => {};
  if (captureStarted || window.__gayatriPwaCapture) return () => {};
  captureStarted = true;
  window.__gayatriPwaCapture = true;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    notify();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notify();
  });

  return () => {};
}

export async function promptPwaInstall() {
  if (!deferredPrompt) return { ok: false, reason: "unavailable" };
  const promptEvent = deferredPrompt;
  try {
    promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    deferredPrompt = null;
    notify();
    return { ok: choice?.outcome === "accepted", reason: choice?.outcome || "done" };
  } catch {
    deferredPrompt = null;
    notify();
    return { ok: false, reason: "failed" };
  }
}
