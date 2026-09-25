/**
 * Merge Postgres desk snapshot into the React desk state.
 * Property / UI prefs stay local; live ops (guests, bookings, payments, …) come from the server.
 */

import { KEY } from "./lib";
import { getState } from "./store";
import { fetchDeskSnapshot } from "./api/ops";

function sid(prefix, id) {
  return id == null ? "" : `${prefix}${id}`;
}

function mapGuest(g) {
  return {
    id: sid("api-g-", g.id),
    serverId: g.id,
    name: g.name || "",
    phone: g.phone || "",
    email: g.email || "",
    address: g.address || "",
    gstin: g.gstin || "",
    nationality: g.nationality || "India",
    idProof: { type: g.idProofType || "", number: g.idProofNumber || "" },
    company: "",
    emergency: "",
    preferences: "",
    tags: [],
  };
}

function mapHall(h, i) {
  return {
    id: sid("api-h-", h.id),
    serverId: h.id,
    code: h.code,
    name: h.name,
    capacity: h.capacity || 0,
    halfDayRate: Number(h.halfDayRate || 0),
    fullDayRate: Number(h.fullDayRate || 0),
    active: h.active !== false,
    sort: i,
  };
}

function mapRoom(r) {
  return {
    id: sid("api-r-", r.id),
    serverId: r.id,
    number: r.number,
    floor: r.floor || "",
    status: r.status || "Available",
    hkStatus: r.hkStatus || "Clean",
    typeId: r.typeId != null ? sid("api-rt-", r.typeId) : "",
    typeName: r.typeName || "",
    baseRate: Number(r.baseRate || 0),
    active: r.active !== false,
  };
}

function mapBooking(b) {
  return {
    id: sid("api-b-", b.id),
    serverId: b.id,
    number: b.number,
    guestId: sid("api-g-", b.guestId),
    type: b.type || "Event",
    source: b.source || "",
    status: b.status || "Confirmed",
    eventDate: b.eventDate,
    guestsExpected: b.guestsExpected || 0,
    notes: b.notes || "",
    discount: Number(b.discount || 0),
    packageId: "",
    createdAt: b.createdAt || new Date().toISOString(),
    hallCodes: b.hallCodes || [],
    roomNumbers: b.roomNumbers || [],
    folioId: b.folioId != null ? sid("api-f-", b.folioId) : "",
    paymentsTotal: Number(b.paymentsTotal || 0),
  };
}

function mapPayment(p) {
  return {
    id: sid("api-p-", p.id),
    serverId: p.id,
    bookingId: sid("api-b-", p.bookingId),
    amount: Number(p.amount || 0),
    method: p.method || "Cash",
    type: p.type || "Payment",
    at: p.paidAt || new Date().toISOString(),
    ref: p.refNo || "",
  };
}

function mapEnquiry(e) {
  return {
    id: sid("api-e-", e.id),
    serverId: e.id,
    bookingId: e.bookingId != null ? sid("api-b-", e.bookingId) : "",
    name: e.name,
    phone: e.phone || "",
    email: e.email || "",
    date: e.eventDate,
    hall: e.hallCode || "",
    guests: e.guestsExpected || 0,
    message: e.message || "",
    status: e.status || "Open",
    bookingNumber: e.bookingNumber || "",
  };
}

function mapExpense(x) {
  return {
    id: sid("api-x-", x.id),
    serverId: x.id,
    category: x.category,
    description: x.description,
    amount: Number(x.amount || 0),
    date: x.spentOn,
    method: x.paymentMethod || "",
    vendor: x.vendor || "",
    notes: x.notes || "",
    verified: Boolean(x.verified),
    receiptDocId: x.receiptDocId != null ? sid("api-d-", x.receiptDocId) : "",
    createdBy: x.createdByName || "",
  };
}

function mapRefund(r) {
  return {
    id: sid("api-rf-", r.id),
    serverId: r.id,
    bookingId: sid("api-b-", r.bookingId),
    paymentId: r.paymentId != null ? sid("api-p-", r.paymentId) : "",
    amount: Number(r.amount || 0),
    status: r.status || "Pending",
    reason: r.reason || "",
    requestedBy: r.requestedByName || "",
    approvedBy: r.approvedByName || "",
    at: r.createdAt || new Date().toISOString(),
  };
}

function mapDocument(d) {
  return {
    id: sid("api-d-", d.id),
    serverId: d.id,
    bookingId: d.bookingId != null ? sid("api-b-", d.bookingId) : "",
    guestId: d.guestId != null ? sid("api-g-", d.guestId) : "",
    typeId: d.typeCode || "",
    name: d.fileName || "",
    contentType: d.contentType || "",
    size: Number(d.sizeBytes || 0),
    at: d.createdAt || new Date().toISOString(),
    verified: false,
    serverFile: true,
  };
}

function mapInvoice(inv) {
  return {
    id: sid("api-i-", inv.id),
    serverId: inv.id,
    number: inv.number,
    type: inv.type,
    bookingId: sid("api-b-", inv.bookingId),
    at: inv.issuedAt || inv.createdAt,
    status: inv.status || "Issued",
  };
}

/** Build calendar reservation rows from booking hall/room labels. */
function reservationsFromBookings(bookings, halls, rooms) {
  const hallByCode = Object.fromEntries((halls || []).map((h) => [String(h.code || "").toUpperCase(), h]));
  const roomByNumber = Object.fromEntries((rooms || []).map((r) => [String(r.number || ""), r]));
  const hallReservations = [];
  const roomReservations = [];
  for (const b of bookings || []) {
    if (String(b.status || "").toLowerCase() === "cancelled") continue;
    for (const code of b.hallCodes || []) {
      const hall = hallByCode[String(code).toUpperCase()];
      hallReservations.push({
        id: `hr-${b.id}-${code}`,
        bookingId: b.id,
        hallId: hall?.id || "",
        hallCode: code,
        eventDate: b.eventDate,
        slotType: "full-day",
        status: "Booked",
        amount: 0,
      });
    }
    for (const num of b.roomNumbers || []) {
      const room = roomByNumber[String(num)];
      roomReservations.push({
        id: `rr-${b.id}-${num}`,
        bookingId: b.id,
        roomId: room?.id || "",
        roomNumber: num,
        guestId: b.guestId,
        checkIn: b.eventDate,
        checkOut: b.eventDate,
        status: "Reserved",
        amount: 0,
      });
    }
  }
  return { hallReservations, roomReservations };
}

function foliosFromBookings(bookings) {
  const folios = [];
  for (const b of bookings || []) {
    if (!b.folioId) continue;
    folios.push({
      id: b.folioId,
      bookingId: b.id,
      status: String(b.status || "").toLowerCase() === "cancelled" ? "Cancelled" : "Open",
      discount: Number(b.discount || 0),
    });
  }
  return folios;
}

export function applyDeskSnapshot(snap, base = getState()) {
  const halls = (snap.halls || []).map(mapHall);
  const rooms = (snap.rooms || []).map(mapRoom);
  const guests = (snap.guests || []).map(mapGuest);
  const bookings = (snap.bookings || []).map(mapBooking);
  const payments = (snap.payments || []).map(mapPayment);
  const enquiries = (snap.enquiries || []).map(mapEnquiry);
  const expenses = (snap.expenses || []).map(mapExpense);
  const refunds = (snap.refunds || []).map(mapRefund);
  const documents = (snap.documents || []).map(mapDocument);
  const invoices = (snap.invoices || []).map(mapInvoice);
  const { hallReservations, roomReservations } = reservationsFromBookings(bookings, halls, rooms);
  const folios = foliosFromBookings(bookings);

  // Keep property / catalogs / UI prefs from local seed; replace live ops from server.
  const next = {
    ...base,
    meta: {
      ...(base.meta || {}),
      version: base.meta?.version || 3,
      source: "server",
      serverSyncedAt: snap.generatedAt || new Date().toISOString(),
    },
    halls: halls.length ? halls : base.halls,
    rooms: rooms.length ? rooms : base.rooms,
    guests,
    bookings,
    payments,
    enquiries,
    expenses,
    refunds,
    documents,
    invoices,
    hallReservations,
    roomReservations,
    folios,
    folioLines: base.folioLines || [],
  };

  // Room types: derive from rooms if present
  const typeMap = new Map();
  for (const r of rooms) {
    if (r.typeId && !typeMap.has(r.typeId)) {
      typeMap.set(r.typeId, {
        id: r.typeId,
        serverId: Number(String(r.typeId).replace("api-rt-", "")) || null,
        name: r.typeName || "Room",
        code: r.typeName || "",
        baseRate: r.baseRate || 0,
        extraBed: 0,
      });
    }
  }
  if (typeMap.size) next.roomTypes = [...typeMap.values()];

  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export async function hydrateDeskFromServer() {
  const snap = await fetchDeskSnapshot();
  return applyDeskSnapshot(snap);
}

/** One-time export of local-only desk data for manual review / import tooling. */
export function exportLocalDeskBackup() {
  const state = getState();
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `gayatri-local-desk-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
