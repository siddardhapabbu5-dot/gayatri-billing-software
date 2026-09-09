/** Public vs Staff app mode — one codebase, two nav / install experiences. */

import { getAuthUser, getToken } from "../api/client";

export const APP_MODE_KEY = "gayatri-app-mode";
export const MODE_PUBLIC = "public";
export const MODE_STAFF = "staff";

const listeners = new Set();

function notify(mode) {
  for (const fn of listeners) fn(mode);
}

export function subscribeAppMode(fn) {
  listeners.add(fn);
  fn(getAppMode());
  return () => listeners.delete(fn);
}

export function readStoredAppMode() {
  try {
    const v = localStorage.getItem(APP_MODE_KEY);
    if (v === MODE_STAFF || v === MODE_PUBLIC) return v;
  } catch {
    /* ignore */
  }
  return null;
}

export function isStaffSignedIn() {
  return Boolean(getToken() && getAuthUser());
}

/** URL forces staff mode: ?mode=staff, #staff, #staff/... */
export function urlRequestsStaffMode() {
  if (typeof window === "undefined") return false;
  try {
    const q = new URLSearchParams(window.location.search);
    if (q.get("mode") === MODE_STAFF) return true;
    if (q.get("mode") === MODE_PUBLIC) return false;
  } catch {
    /* ignore */
  }
  const hash = String(window.location.hash || "").replace(/^#/, "");
  if (!hash) return false;
  return hash === "staff" || hash.startsWith("staff/");
}

export function urlRequestsPublicMode() {
  if (typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).get("mode") === MODE_PUBLIC;
  } catch {
    return false;
  }
}

/**
 * Staff app: Staff link in nav + desk entry.
 * Public app: visual site only (Home → Terms).
 */
export function getAppMode() {
  if (urlRequestsPublicMode() && !isStaffSignedIn()) return MODE_PUBLIC;
  if (urlRequestsStaffMode() || isStaffSignedIn()) return MODE_STAFF;
  const stored = readStoredAppMode();
  if (stored) return stored;
  return MODE_PUBLIC;
}

export function isStaffAppMode() {
  return getAppMode() === MODE_STAFF;
}

export function setAppMode(mode) {
  const next = mode === MODE_STAFF ? MODE_STAFF : MODE_PUBLIC;
  try {
    localStorage.setItem(APP_MODE_KEY, next);
  } catch {
    /* ignore */
  }
  applyManifestForMode(next);
  notify(next);
  return next;
}

export function enableStaffAppMode() {
  return setAppMode(MODE_STAFF);
}

export function enablePublicAppMode() {
  return setAppMode(MODE_PUBLIC);
}

/** Sync mode from current URL (hash / query) without wiping an explicit public preference unless URL asks staff. */
export function syncAppModeFromUrl() {
  if (urlRequestsPublicMode() && !isStaffSignedIn()) {
    return setAppMode(MODE_PUBLIC);
  }
  if (urlRequestsStaffMode() || isStaffSignedIn()) {
    return setAppMode(MODE_STAFF);
  }
  applyManifestForMode(getAppMode());
  return getAppMode();
}

export function staffManifestHref() {
  return "/manifest-staff.webmanifest";
}

export function publicManifestHref() {
  return "/manifest.webmanifest";
}

/** Point the document at the matching PWA manifest (public vs staff install). */
export function applyManifestForMode(mode = getAppMode()) {
  if (typeof document === "undefined") return;
  const href = mode === MODE_STAFF ? staffManifestHref() : publicManifestHref();
  let link = document.querySelector('link[rel="manifest"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "manifest";
    document.head.appendChild(link);
  }
  if (link.getAttribute("href") !== href) {
    link.setAttribute("href", href);
  }
  const appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if (appleTitle) {
    appleTitle.setAttribute("content", mode === MODE_STAFF ? "Gayatri Staff" : "Gayatri");
  }
}
