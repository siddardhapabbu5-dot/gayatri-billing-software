/** Shared PWA install helpers — one deferred prompt for the whole app. */

let deferredPrompt = null;
const listeners = new Set();

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

export function initPwaInstallCapture() {
  if (typeof window === "undefined") return () => {};
  if (window.__gayatriPwaCapture) return () => {};
  window.__gayatriPwaCapture = true;

  const onPrompt = (e) => {
    e.preventDefault();
    deferredPrompt = e;
    notify();
  };
  window.addEventListener("beforeinstallprompt", onPrompt);
  return () => {
    window.removeEventListener("beforeinstallprompt", onPrompt);
    window.__gayatriPwaCapture = false;
  };
}

export async function promptPwaInstall() {
  if (!deferredPrompt) return { ok: false, reason: "unavailable" };
  deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  deferredPrompt = null;
  notify();
  return { ok: choice?.outcome === "accepted", reason: choice?.outcome || "done" };
}
