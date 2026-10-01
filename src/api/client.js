/** JWT + REST client for Gayatri Spring Boot API (proxied via Vite /api in local; absolute URL in production). */

const TOKEN_KEY = "gayatri-vhms-jwt";
const USER_KEY = "gayatri-vhms-auth-user";

/** Empty in local (Vite proxies /api → :8080). Set VITE_API_BASE on Vercel/Netlify to Railway URL, e.g. https://xxx.up.railway.app */
const API_BASE = String(import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");

export function apiUrl(path) {
  const p = path.startsWith("/") ? path : `/api/${path}`;
  if (API_BASE && p.startsWith("/api")) return `${API_BASE}${p}`;
  return p;
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getAuthUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function saveAuth(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  let res;
  try {
    res = await fetch(apiUrl(path.startsWith("/") ? path : `/api/${path}`), {
      ...options,
      headers,
      signal: options.signal || ctrl.signal,
    });
  } catch (err) {
    const failed = new Error(apiFailureText(err));
    failed.cause = err;
    failed.reason = apiFailureText(err);
    recordDiag({ lastApi: path, lastApiResult: failed.reason });
    throw failed;
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 401 && token) {
    clearAuth();
  }

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }

  if (!res.ok) {
    const msg = data?.detail || data?.error || data?.message || `Request failed (${res.status})`;
    const err = new Error(httpFailureText(res.status, msg));
    err.status = res.status;
    err.details = data?.details;
    err.reason = err.message;
    if (res.status === 401 && token) err.auth = tokenExpired(token) ? "expired" : "rejected";
    recordDiag({ lastApi: path, lastApiResult: err.reason });
    throw err;
  }
  recordDiag({ lastApi: path, lastApiResult: "ok", lastApiAt: new Date().toISOString() });
  return data;
}

function tokenExpired(token) {
  try {
    const part = String(token || "").split(".")[1];
    if (!part) return false;
    const json = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
    return Number(json.exp) > 0 && json.exp * 1000 <= Date.now();
  } catch {
    return false;
  }
}

function apiFailureText(err) {
  const name = err?.name || "";
  if (name === "AbortError") return "API timeout";
  return "Cannot connect to server";
}

function httpFailureText(status, message) {
  if (status === 401) return message || "Authentication failed";
  if (status === 503 || /database|connection/i.test(message || "")) return message || "Database unavailable";
  return message || "Cannot connect to server";
}

const DIAG_KEY = "gayatri-diag";

export function recordDiag(patch) {
  let prev = {};
  try {
    prev = JSON.parse(sessionStorage.getItem(DIAG_KEY) || "{}");
  } catch {
    prev = {};
  }
  const next = { ...prev, ...patch };
  try {
    sessionStorage.setItem(DIAG_KEY, JSON.stringify(next));
  } catch {
    /* private mode */
  }
  console.info("[gayatri]", next);
}

export function readDiag() {
  try {
    return JSON.parse(sessionStorage.getItem(DIAG_KEY) || "{}");
  } catch {
    return {};
  }
}

async function withNetworkRetry(fn) {
  let last;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (err.status) throw err;
      await new Promise((resolve) => setTimeout(resolve, 700));
    }
  }
  throw last;
}

export async function login(email, password) {
  try {
    const data = await withNetworkRetry(() => api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }));
    const role = String(data.user.role || "").toLowerCase();
    const normalized =
      role === "staff" || role === "front_desk"
        ? "frontdesk"
        : role === "owner" || role === "administrator"
          ? "admin"
          : role;
    const user = {
      id: `api-${data.user.id}`,
      name: data.user.fullName,
      email: data.user.email,
      role: normalized,
      permissions: data.user.permissions || [],
      roleLabel: data.user.roleLabel,
    };
    saveAuth(data.token, user);
    recordDiag({ lastLogin: user.email, lastLoginAt: new Date().toISOString(), lastLoginResult: "ok" });
    return { token: data.token, user, expiresInMs: data.expiresInMs };
  } catch (err) {
    recordDiag({ lastLogin: email, lastLoginAt: new Date().toISOString(), lastLoginResult: err.reason || err.message });
    throw err;
  }
}

export function requestPasswordOtp(phone) {
  return api("/api/auth/forgot/otp", {
    method: "POST",
    body: JSON.stringify({ phone }),
  });
}

export function verifyPasswordOtp(phone, otp) {
  return api("/api/auth/forgot/verify", {
    method: "POST",
    body: JSON.stringify({ phone, otp }),
  });
}

export function resetForgottenPassword(resetToken, password) {
  return api("/api/auth/forgot/reset", {
    method: "POST",
    body: JSON.stringify({ resetToken, password }),
  });
}

export async function fetchMe() {
  const data = await api("/api/auth/me");
  const role = String(data.role || "").toLowerCase();
  const normalized =
    role === "staff" || role === "front_desk"
      ? "frontdesk"
      : role === "owner" || role === "administrator"
        ? "admin"
        : role;
  const user = {
    id: `api-${data.id}`,
    name: data.fullName,
    email: data.email,
    role: normalized,
    permissions: data.permissions || [],
    roleLabel: data.roleLabel,
  };
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  return user;
}

export async function fetchServerStatus() {
  try {
    const data = await api("/api/health");
    const database = data?.database === "connected" || data?.database === "UP" ? "connected" : "unavailable";
    return {
      reachable: true,
      server: data?.server || "online",
      status: data?.status || "UP",
      database,
      authentication: data?.authentication || "",
      sync: data?.sync || "",
      timestamp: data?.timestamp || "",
      service: data?.service || "",
    };
  } catch (err) {
    return {
      reachable: false,
      server: "offline",
      status: "DOWN",
      database: "unavailable",
      authentication: "unavailable",
      sync: "unavailable",
      timestamp: "",
      service: "",
      reason: err.reason || err.message || "Cannot connect to server",
    };
  }
}

export async function healthCheck() {
  const status = await fetchServerStatus();
  return status.reachable && status.database === "connected";
}

export async function listStaffUsers(archived = false) {
  const q = archived ? "?archived=true" : "";
  const data = await api(`/api/admin/users${q}`);
  return (data || []).map((u) => ({
    id: `api-${u.id}`,
    serverId: u.id,
    name: u.fullName,
    email: u.email,
    role: String(u.role || "").toLowerCase(),
    roleLabel: u.roleLabel,
    permissions: u.permissions || [],
    active: u.active !== false,
    removed: Boolean(u.removed),
    removedAt: u.removedAt || null,
    phone: u.phone || "",
  }));
}

export async function createStaffUser({ email, password, fullName, role }) {
  const data = await api("/api/admin/users", {
    method: "POST",
    body: JSON.stringify({ email, password, fullName, role }),
  });
  return {
    id: `api-${data.id}`,
    serverId: data.id,
    name: data.fullName,
    email: data.email,
    role: String(data.role || "").toLowerCase(),
    roleLabel: data.roleLabel,
    permissions: data.permissions || [],
    active: data.active !== false,
    removed: Boolean(data.removed),
    removedAt: data.removedAt || null,
    phone: data.phone || "",
  };
}

export async function updateStaffUser(serverId, patch) {
  const data = await api(`/api/admin/users/${serverId}`, {
    method: "PUT",
    body: JSON.stringify(patch),
  });
  return {
    id: `api-${data.id}`,
    serverId: data.id,
    name: data.fullName,
    email: data.email,
    role: String(data.role || "").toLowerCase(),
    roleLabel: data.roleLabel,
    permissions: data.permissions || [],
    active: data.active !== false,
    removed: Boolean(data.removed),
    removedAt: data.removedAt || null,
    phone: data.phone || "",
  };
}

export async function removeStaffUser(serverId) {
  const data = await api(`/api/admin/users/${serverId}/remove`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  return {
    id: `api-${data.id}`,
    serverId: data.id,
    name: data.fullName,
    email: data.email,
    role: String(data.role || "").toLowerCase(),
    roleLabel: data.roleLabel,
    permissions: data.permissions || [],
    active: data.active !== false,
    removed: Boolean(data.removed),
    removedAt: data.removedAt || null,
  };
}

export async function fetchRbacMatrix() {
  return api("/api/admin/rbac/matrix");
}

export async function saveRolePermissions(role, permissions) {
  return api("/api/admin/rbac/roles", {
    method: "PUT",
    body: JSON.stringify({ role, permissions }),
  });
}

export async function fetchRbacSettings() {
  return api("/api/admin/rbac/settings");
}

export async function saveManagerRefundLimit(amount) {
  return api("/api/admin/rbac/settings/manager-refund-limit", {
    method: "PUT",
    body: JSON.stringify({ amount }),
  });
}

export async function saveBookingPolicies(policies) {
  return api("/api/admin/rbac/settings/booking-policies", {
    method: "PUT",
    body: JSON.stringify({ policiesJson: JSON.stringify(policies || {}) }),
  });
}

export async function fetchRbacAudit() {
  return api("/api/admin/rbac/audit");
}

export async function fetchStaffRoles() {
  return api("/api/auth/roles");
}
