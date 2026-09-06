/** JWT + REST client for Gayatri Spring Boot API (proxied via Vite /api). */

const TOKEN_KEY = "gayatri-vhms-jwt";
const USER_KEY = "gayatri-vhms-auth-user";

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

  const res = await fetch(path.startsWith("/") ? path : `/api/${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
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
    const msg = data?.error || data?.message || `Request failed (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.details = data?.details;
    throw err;
  }
  return data;
}

export async function login(email, password) {
  const data = await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  const role = String(data.user.role || "").toLowerCase();
  const user = {
    id: `api-${data.user.id}`,
    name: data.user.fullName,
    email: data.user.email,
    role,
    permissions: data.user.permissions || [],
    roleLabel: data.user.roleLabel,
  };
  saveAuth(data.token, user);
  return { token: data.token, user, expiresInMs: data.expiresInMs };
}

export async function fetchMe() {
  const data = await api("/api/auth/me");
  const role = String(data.role || "").toLowerCase();
  const user = {
    id: `api-${data.id}`,
    name: data.fullName,
    email: data.email,
    role,
    permissions: data.permissions || [],
    roleLabel: data.roleLabel,
  };
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  return user;
}

export async function healthCheck() {
  try {
    const data = await api("/api/health");
    return data?.status === "UP";
  } catch {
    return false;
  }
}
