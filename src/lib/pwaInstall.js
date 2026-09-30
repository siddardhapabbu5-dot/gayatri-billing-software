/** Shared PWA install helpers — one deferred prompt for the whole app. */

let deferredPrompt = null;
let promptFired = false;
const listeners = new Set();
const dialogListeners = new Set();
let dialogOpen = false;
let captureStarted = false;

function notify() {
  for (const fn of listeners) fn(deferredPrompt);
}

function notifyDialog() {
  for (const fn of dialogListeners) fn(dialogOpen);
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
    promptFired = true;
    deferredPrompt = e;
    notify();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notify();
  });

  return () => {};
}

export function didBeforeInstallPromptFire() {
  return promptFired;
}

export function openPwaInstallDialog() {
  dialogOpen = true;
  notifyDialog();
}

export function closePwaInstallDialog() {
  dialogOpen = false;
  notifyDialog();
}

export function subscribePwaDialog(fn) {
  dialogListeners.add(fn);
  fn(dialogOpen);
  return () => dialogListeners.delete(fn);
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

/** Chrome install prompt, or a signal to show the manual guide. */
export async function installPWA() {
  if (!deferredPrompt) {
    openPwaInstallDialog();
    return { ok: false, reason: "manual" };
  }
  const result = await promptPwaInstall();
  return result.ok ? result : { ...result, reason: result.reason === "unavailable" ? "manual" : result.reason };
}

/** True only when /downloads/staff-app.apk is a real Android package (a zip), not the website HTML. */
export async function apkIsAvailable() {
  try {
    const res = await fetch("/downloads/staff-app.apk", { headers: { Range: "bytes=0-3" } });
    const type = res.headers.get("content-type") || "";
    if (!res.ok || type.includes("text/html")) return false;
    const bytes = new Uint8Array(await res.arrayBuffer());
    return bytes[0] === 0x50 && bytes[1] === 0x4b;
  } catch {
    return false;
  }
}
