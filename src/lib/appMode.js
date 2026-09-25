/** Public vs Staff app mode — one codebase, two nav / install experiences. */

import { getAuthUser, getToken } from "../api/client";

export const APP_MODE_KEY = "gayatri-app-mode";
export const MODE_PUBLIC = "public";
export const MODE_STAFF = "staff";

/** Preferred staff entry on the main domain (Hostinger VPS). */
export const STAFF_PATH = "/staff";

/** Production hosts (custom domains). */
export const PUBLIC_HOSTS = new Set(["gayatriconvention.com", "www.gayatriconvention.com"]);
/** Legacy staff subdomain — still recognised; prefer /staff on the main domain. */
export const STAFF_HOSTS = new Set(["app.gayatriconvention.com"]);

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

export function currentHostname() {
  if (typeof window === "undefined") return "";
  return String(window.location.hostname || "").toLowerCase();
}

export function currentPathname() {
  if (typeof window === "undefined") return "/";
  return String(window.location.pathname || "/");
}

/** True for `/staff` and `/staff/...` (trailing slash ignored). */
export function isStaffPath(pathname = currentPathname()) {
  const p = String(pathname || "/").replace(/\/+$/, "") || "/";
  return p === STAFF_PATH || p.startsWith(`${STAFF_PATH}/`);
}

/**
 * Custom-domain host → fixed mode.
 * Railway / localhost return null (use ?mode= / path / hash / storage).
 */
export function modeFromHostname(hostname = currentHostname()) {
  const h = String(hostname || "").toLowerCase();
  if (!h) return null;
  if (STAFF_HOSTS.has(h)) return MODE_STAFF;
  if (PUBLIC_HOSTS.has(h)) return MODE_PUBLIC;
  return null;
}

/** Staff desk entry without a session: `/staff` path or legacy app. subdomain. */
export function isStaffEntryUnsigned() {
  if (isStaffSignedIn()) return false;
  if (isStaffPath()) return true;
  return modeFromHostname() === MODE_STAFF;
}

export function staffLoginHref() {
  /** Clean staff entry — no hash in the address bar. */
  return STAFF_PATH;
}

export function staffPageHref(pageId = "desk") {
  if (pageId === "home" || pageId === "portal") return "/#home";
  if (pageId === "login") return STAFF_PATH;
  return `${STAFF_PATH}#staff/${pageId}`;
}

export function publicHomeHref() {
  return "/#home";
}

/** URL forces staff mode: /staff, ?mode=staff, #staff, #staff/... */
export function urlRequestsStaffMode() {
  if (typeof window === "undefined") return false;
  if (isStaffPath()) return true;
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
  if (isStaffPath()) return false;
  try {
    return new URLSearchParams(window.location.search).get("mode") === MODE_PUBLIC;
  } catch {
    return false;
  }
}

/**
 * Staff app: Staff link in nav + desk entry.
 * Public app: visual site only (Home → Terms).
 *
 * Priority: /staff path → explicit ?mode= → signed-in / #staff → host → storage → public.
 */
export function getAppMode() {
  if (isStaffPath()) return MODE_STAFF;
  if (urlRequestsPublicMode() && !isStaffSignedIn()) return MODE_PUBLIC;
  if (urlRequestsStaffMode() || isStaffSignedIn()) return MODE_STAFF;
  const fromHost = modeFromHostname();
  if (fromHost) return fromHost;
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

/** Sync mode from host / URL (path / hash / query). */
export function syncAppModeFromUrl() {
  if (isStaffPath()) {
    return setAppMode(MODE_STAFF);
  }
  if (urlRequestsPublicMode() && !isStaffSignedIn()) {
    return setAppMode(MODE_PUBLIC);
  }
  if (urlRequestsStaffMode() || isStaffSignedIn()) {
    return setAppMode(MODE_STAFF);
  }
  const fromHost = modeFromHostname();
  if (fromHost) {
    return setAppMode(fromHost);
  }
  applyManifestForMode(getAppMode());
  return getAppMode();
}

/**
 * One-time: legacy app.gayatriconvention.com → main domain /staff.
 * No-op on localhost / when already on a public host path.
 */
export function redirectLegacyStaffHost() {
  if (typeof window === "undefined") return false;
  const host = currentHostname();
  if (!STAFF_HOSTS.has(host)) return false;
  const targetHost = "gayatriconvention.com";
  const hash = window.location.hash || "";
  const nextHash = hash.startsWith("#staff/") && hash !== "#staff/login" ? hash : "";
  window.location.replace(`https://${targetHost}${STAFF_PATH}${nextHash}`);
  return true;
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
