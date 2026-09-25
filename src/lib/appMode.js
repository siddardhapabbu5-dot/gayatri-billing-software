/** Public vs Staff app mode — one codebase, two nav / install experiences. */

import { getAuthUser, getToken } from "../api/client";

export const APP_MODE_KEY = "gayatri-app-mode";
export const MODE_PUBLIC = "public";
export const MODE_STAFF = "staff";

/** Preferred staff entry on the main domain (Hostinger VPS). */
export const STAFF_PATH = "/staff";

/**
 * Internal page id → clean URL slug under /staff/...
 * Dashboard uses bare /staff (no /desk suffix) when signed in.
 */
export const STAFF_PAGE_SLUGS = {
  desk: "desk",
  calendar: "calendar",
  venues: "venues",
  rooms: "rooms",
  reserve: "reservations",
  guests: "guests",
  documents: "documents",
  vendors: "vendors",
  billing: "billing",
  expenses: "expenses",
  reports: "reports",
  users: "users",
  roles: "roles",
  settings: "settings",
  master: "master",
};

/** Slug → page id (includes legacy aliases). */
export const STAFF_SLUG_TO_PAGE = {
  ...Object.fromEntries(Object.entries(STAFF_PAGE_SLUGS).map(([page, slug]) => [slug, page])),
  reserve: "reserve",
  login: "login",
  desk: "desk",
  /** Retired route — deep links land on the dashboard. */
  assistant: "desk",
};

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

function normalizePath(pathname = currentPathname()) {
  const p = String(pathname || "/").replace(/\/+$/, "") || "/";
  return p;
}

/** True for `/staff` and `/staff/...` (trailing slash ignored). */
export function isStaffPath(pathname = currentPathname()) {
  const p = normalizePath(pathname);
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
  return STAFF_PATH;
}

/**
 * Clean staff URLs — never emit #staff/... fragments.
 * /staff → login (unsigned) or dashboard (signed in)
 * /staff/calendar → calendar, /staff/reservations → reserve, etc.
 */
export function staffPageHref(pageId = "desk") {
  if (pageId === "home" || pageId === "portal") return "/";
  if (pageId === "login" || pageId === "desk") return STAFF_PATH;
  const slug = STAFF_PAGE_SLUGS[pageId] || pageId;
  return `${STAFF_PATH}/${slug}`;
}

export function publicHomeHref() {
  return "/";
}

/**
 * Resolve staff page id from pathname.
 * Returns "login" for bare /staff when the caller should show the gate;
 * returns "desk" for bare /staff when signed in (pass signedIn=true).
 */
export function pageFromStaffPath(pathname = currentPathname(), { signedIn = isStaffSignedIn() } = {}) {
  const p = normalizePath(pathname);
  if (p === STAFF_PATH) return signedIn ? "desk" : "login";
  if (!p.startsWith(`${STAFF_PATH}/`)) return null;
  const slug = p.slice(STAFF_PATH.length + 1).split(/[/?#]/)[0];
  if (!slug || slug === "login") return signedIn ? "desk" : "login";
  if (slug === "desk") return "desk";
  return STAFF_SLUG_TO_PAGE[slug] || null;
}

/**
 * Rewrite legacy `#staff/...` bookmarks to clean `/staff/...` paths (strips the hash).
 * Returns true if the URL was changed.
 */
export function migrateStaffHashToPath() {
  if (typeof window === "undefined") return false;
  const hash = String(window.location.hash || "").replace(/^#/, "");
  if (!hash || !(hash === "staff" || hash.startsWith("staff/"))) return false;

  let pageId = "desk";
  if (hash === "staff" || hash === "staff/login") {
    pageId = "login";
  } else {
    const id = hash.slice(6).split(/[/?#]/)[0];
    if (!id || id === "desk") pageId = "desk";
    else if (id === "login") pageId = "login";
    else pageId = STAFF_SLUG_TO_PAGE[id] || id;
  }

  const target = pageId === "login" || pageId === "desk" ? STAFF_PATH : staffPageHref(pageId);
  const search = window.location.search || "";
  const next = `${target}${search}`;
  const here = `${window.location.pathname}${window.location.search || ""}`;
  if (here === next && !window.location.hash) return false;
  window.history.replaceState(null, "", next);
  return true;
}

/** URL forces staff mode: /staff, ?mode=staff, legacy #staff */
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
 * Legacy app.gayatriconvention.com → main domain /staff (path, not hash).
 */
export function redirectLegacyStaffHost() {
  if (typeof window === "undefined") return false;
  const host = currentHostname();
  if (!STAFF_HOSTS.has(host)) return false;
  const targetHost = "gayatriconvention.com";
  const path = normalizePath();
  const staffTail = isStaffPath(path) && path !== STAFF_PATH ? path.slice(STAFF_PATH.length) : "";
  const hash = String(window.location.hash || "").replace(/^#/, "");
  let dest = STAFF_PATH;
  if (staffTail) {
    dest = `${STAFF_PATH}${staffTail}`;
  } else if (hash === "staff" || hash === "staff/login") {
    dest = STAFF_PATH;
  } else if (hash.startsWith("staff/")) {
    const id = hash.slice(6).split(/[/?#]/)[0];
    dest = id && id !== "login" && id !== "desk" ? staffPageHref(STAFF_SLUG_TO_PAGE[id] || id) : STAFF_PATH;
  }
  window.location.replace(`https://${targetHost}${dest}`);
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
