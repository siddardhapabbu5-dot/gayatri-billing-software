/** Server ops API — Postgres is source of truth for live desk data. */

import { api, apiUrl, getToken } from "./client";

export async function fetchDeskSnapshot() {
  return api("/api/desk/snapshot");
}

export async function submitPublicEnquiry(body) {
  return api("/api/public/enquiries", {
    method: "POST",
    body: JSON.stringify({
      name: body.name,
      phone: body.phone || null,
      email: body.email || null,
      date: body.date || null,
      hall: body.hall || null,
      guests: body.guests != null ? Number(body.guests) : null,
      message: body.message || null,
      agreeHall: Boolean(body.agreeHall),
      agreeRoom: Boolean(body.agreeRoom),
    }),
  });
}

export async function createGuest(body) {
  return api("/api/guests", {
    method: "POST",
    body: JSON.stringify({
      name: body.name,
      phone: body.phone || null,
      email: body.email || null,
      address: body.address || null,
      gstin: body.gstin || null,
      nationality: body.nationality || "India",
      idProofType: body.idProofType || body.idProof?.type || null,
      idProofNumber: body.idProofNumber || body.idProof?.number || null,
      leadStatus: body.leadStatus || null,
      leadSource: body.leadSource || null,
      notes: body.notes || null,
    }),
  });
}

export async function uploadGuestDocument(guestId, typeCode, file) {
  const body = new FormData();
  body.append("file", file);
  body.append("guestId", String(guestId));
  body.append("typeCode", typeCode);
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(apiUrl("/api/documents"), { method: "POST", headers, body });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { error: text }; }
  if (!res.ok) throw new Error(data?.detail || data?.message || data?.error || "Upload failed");
  return data;
}

export async function updateGuest(id, body) {
  return api(`/api/guests/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function createBooking(body) {
  return api("/api/bookings", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function setBookingGst(id, gstMode) {
  return api(`/api/bookings/${id}/gst`, {
    method: "PUT",
    body: JSON.stringify({ gstMode }),
  });
}

export async function updateBookingApi(id, body) {
  return api(`/api/bookings/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function cancelBookingApi(id) {
  return api(`/api/bookings/${id}/cancel`, { method: "POST" });
}

export async function deleteBookingApi(id) {
  return api(`/api/bookings/${id}`, { method: "DELETE" });
}

export async function addPaymentApi(bookingId, body) {
  return api(`/api/bookings/${bookingId}/payments`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function createExpenseApi(body) {
  return api("/api/expenses", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function verifyExpenseApi(id, verified = true) {
  return api(`/api/expenses/${id}/verify?verified=${verified ? "true" : "false"}`, {
    method: "PUT",
  });
}

export async function createRefundApi(bookingId, body) {
  return api(`/api/bookings/${bookingId}/refunds`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function approveRefundApi(id, status = "Approved", note = "") {
  const q = new URLSearchParams({ status });
  if (note) q.set("note", note);
  return api(`/api/refunds/${id}/approve?${q}`, { method: "POST" });
}

export async function updateRoomStatusApi(id, status, hkStatus) {
  return api(`/api/rooms/${id}/status`, {
    method: "PUT",
    body: JSON.stringify({ status, hkStatus: hkStatus || null }),
  });
}

export async function uploadDocumentApi({ file, bookingId, guestId, typeCode }) {
  const token = localStorage.getItem("gayatri-vhms-jwt");
  const API_BASE = String(import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");
  const url = `${API_BASE || ""}/api/documents`;
  const fd = new FormData();
  fd.append("file", file);
  if (bookingId) fd.append("bookingId", String(bookingId));
  if (guestId) fd.append("guestId", String(guestId));
  if (typeCode) fd.append("typeCode", typeCode);
  const res = await fetch(url, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text };
  }
  if (!res.ok) {
    throw new Error(data?.error || data?.message || `Upload failed (${res.status})`);
  }
  return data;
}

export async function saveBookingExtras(id, lines) {
  return api(`/api/bookings/${id}/extras`, {
    method: "PUT",
    body: JSON.stringify({ lines: lines || [] }),
  });
}

export async function issueInvoiceApi(bookingId, type) {
  return api(`/api/bookings/${bookingId}/invoices`, {
    method: "POST",
    body: JSON.stringify({ type }),
  });
}
