import { KEY, seqNo, uid } from "./lib";
import { createSeed, DEFAULT_ABOUT, DEFAULT_BANQUET, DEFAULT_EVENT_TYPES, DEFAULT_TERMS } from "./seed";
import { bookingFolio, folioTotals, hallClash, publicAvailability, roomClash } from "./engine";
import { specById } from "./docTypes";
import { clearBlobs, deleteBlob, putBlob } from "./fileStore";

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : createSeed();
    if (!Array.isArray(parsed.documents)) parsed.documents = [];
    parsed.services = [];
    if (parsed.property) {
      const p = parsed.property;
      if (p.notifyWhatsApp == null) p.notifyWhatsApp = true;
      if (!p.notifyPhone) p.notifyPhone = p.phone || "+91 98496 00555";
      if (!p.brandName) p.brandName = "Gayatri";
      if (!p.place) p.place = "Palagummi · Konaseema";
      if (!p.about) p.about = DEFAULT_ABOUT;
      if (!p.banquetIntro) p.banquetIntro = DEFAULT_BANQUET;
      if (!p.terms) p.terms = DEFAULT_TERMS;
      if (!p.mapQuery) p.mapQuery = Array.isArray(p.address) ? p.address.join(" ") : "Palagummi Village Razole";
      if (!Array.isArray(p.eventTypes) || !p.eventTypes.length) p.eventTypes = [...DEFAULT_EVENT_TYPES];
      if (!p.storiesCleared) {
        p.stories = [];
        p.storiesCleared = true;
      }
      if (!Array.isArray(p.stories)) p.stories = [];
    }
    parsed.halls = (parsed.halls || []).map((h) => ({
      ...h,
      jp: h.jp || h.kind || "",
      copy: h.copy || h.tag || "",
    }));
    if (!Array.isArray(parsed.roomTypes)) parsed.roomTypes = [];
    if (!Array.isArray(parsed.packages)) parsed.packages = [];
    return parsed;
  } catch {
    return createSeed();
  }
}

function persist(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
  return state;
}

function audit(state, action, entity, detail, extra = {}) {
  const user = state.users.find((u) => u.id === state.session.userId);
  state.audit = [
    {
      id: uid("a"),
      at: new Date().toISOString(),
      user: user?.name || "System",
      action,
      entity,
      detail,
      ...extra,
    },
    ...state.audit,
  ].slice(0, 400);
}

export function getState() {
  return load();
}

export function setUser(userId) {
  const state = load();
  state.session.userId = userId;
  return persist(state);
}

export function resetDemo() {
  clearBlobs().catch(() => {});
  const next = createSeed();
  return persist(next);
}

export function updateProperty(patch) {
  const state = load();
  const old = { ...state.property };
  state.property = { ...state.property, ...patch };
  audit(state, "Property updated", state.property.name, JSON.stringify(patch));
  return persist(state);
}

export function setRoomStatus(roomId, status) {
  const state = load();
  const room = state.rooms.find((r) => r.id === roomId);
  const prev = room?.status;
  state.rooms = state.rooms.map((r) => (r.id === roomId ? { ...r, status } : r));
  audit(state, "Room status", `Room ${room?.number}`, `${prev} → ${status}`);
  return persist(state);
}

export function updateHall(hallId, patch) {
  const state = load();
  const hall = state.halls.find((h) => h.id === hallId);
  state.halls = state.halls.map((h) => (h.id === hallId ? { ...h, ...patch } : h));
  audit(state, "Hall updated", hall?.name, JSON.stringify(patch));
  return persist(state);
}

export function updateService(id, patch) {
  const state = load();
  state.services = state.services.map((s) => (s.id === id ? { ...s, ...patch } : s));
  return persist(state);
}

function upsert(list, item, prefix) {
  if (item.id && list.some((x) => x.id === item.id)) {
    return list.map((x) => (x.id === item.id ? { ...x, ...item } : x));
  }
  return [...list, { ...item, id: item.id || uid(prefix) }];
}

export function saveHall(item) {
  const state = load();
  const hall = {
    ...item,
    capacity: Number(item.capacity) || 0,
    floating: Number(item.floating) || 0,
    dining: Number(item.dining) || 0,
    parking: Number(item.parking) || 0,
    setupHours: Number(item.setupHours) || 0,
    teardownHours: Number(item.teardownHours) || 0,
    bufferMinutes: Number(item.bufferMinutes) || 0,
    minValue: Number(item.minValue) || 0,
    rates: {
      hourly: Number(item.rates?.hourly) || 0,
      halfDay: Number(item.rates?.halfDay) || 0,
      fullDay: Number(item.rates?.fullDay) || 0,
    },
    seating: Array.isArray(item.seating) ? item.seating : String(item.seating || "").split(",").map((s) => s.trim()).filter(Boolean),
    active: item.active !== false,
  };
  state.halls = upsert(state.halls, hall, "hall");
  audit(state, "Master data", hall.name, "Hall saved");
  return persist(state);
}

export function saveRoomType(item) {
  const state = load();
  const row = {
    ...item,
    baseRate: Number(item.baseRate) || 0,
    extraBed: Number(item.extraBed) || 0,
    childRate: Number(item.childRate) || 0,
    maxGuests: Number(item.maxGuests) || 2,
  };
  state.roomTypes = upsert(state.roomTypes, row, "rt");
  audit(state, "Master data", row.name, "Room type saved");
  return persist(state);
}

export function saveRoom(item) {
  const state = load();
  const row = {
    ...item,
    number: String(item.number || "").trim(),
    floor: Number(item.floor) || 1,
    typeId: item.typeId,
    status: item.status || "Available",
  };
  if (!row.number) return { error: "Room number is required." };
  state.rooms = upsert(state.rooms, row, "r");
  audit(state, "Master data", `Room ${row.number}`, "Room saved");
  return persist(state);
}

export function savePackage(item) {
  const state = load();
  const row = {
    ...item,
    name: String(item.name || "").trim(),
    price: Number(item.price) || 0,
    minGuests: Number(item.minGuests) || 0,
    hallId: item.hallId || "",
    includes: Array.isArray(item.includes)
      ? item.includes
      : String(item.includes || "")
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
  };
  if (!row.name) return { error: "Package name is required." };
  state.packages = upsert(state.packages, row, "pkg");
  audit(state, "Master data", row.name, "Package saved");
  return persist(state);
}

export function removePackage(id) {
  const state = load();
  const pkg = state.packages.find((p) => p.id === id);
  state.packages = state.packages.filter((p) => p.id !== id);
  audit(state, "Master data", pkg?.name || id, "Package removed");
  return persist(state);
}

export function saveGuest(guest) {
  const state = load();
  if (guest.id) {
    state.guests = state.guests.map((g) => (g.id === guest.id ? { ...g, ...guest } : g));
    audit(state, "Guest updated", guest.name, guest.phone);
  } else {
    guest.id = uid("g");
    state.guests.unshift(guest);
    audit(state, "Guest created", guest.name, guest.phone);
  }
  persist(state);
  return { state: load(), guest };
}

export function convertEnquiry(enquiryId) {
  const state = load();
  const enq = state.enquiries.find((e) => e.id === enquiryId);
  if (!enq) return state;
  const booking = state.bookings.find((b) => b.id === enq.bookingId);
  if (booking) booking.status = "Quoted";
  enq.status = "Quoted";
  const inv = {
    id: uid("inv"),
    number: seqNo(state.invoices, "number", "QT"),
    type: "Quotation",
    bookingId: enq.bookingId,
    folioId: "",
    at: new Date().toISOString(),
    status: "Draft",
  };
  state.invoices.unshift(inv);
  audit(state, "Quotation created", inv.number, enq.name);
  return persist(state);
}

export function createReservation(draft) {
  const state = load();
  let guest = state.guests.find((g) => g.phone === draft.guest.phone);
  if (!guest) {
    guest = { id: uid("g"), ...draft.guest, idProof: draft.guest.idProof || { type: "Aadhaar", number: "" }, tags: [draft.source || "Direct"] };
    state.guests.unshift(guest);
  }

  for (const h of draft.halls || []) {
    const hall = state.halls.find((x) => x.id === h.hallId);
    const clash = hallClash(state.hallReservations, h.hallId, h.start, h.end);
    if (clash) {
      return { error: `${hall?.name} conflicts with an existing hold (setup/teardown included).` };
    }
  }
  for (const r of draft.rooms || []) {
    if (r.checkOut <= r.checkIn) return { error: "Check-out must be after check-in." };
    const clash = roomClash(state.roomReservations, r.roomId, r.checkIn, r.checkOut);
    if (clash) {
      const room = state.rooms.find((x) => x.id === r.roomId);
      return { error: `Room ${room?.number} is already held for those nights.` };
    }
  }

  const booking = {
    id: uid("bk"),
    number: seqNo(state.bookings, "number", "BK"),
    guestId: guest.id,
    type: draft.type || "Event",
    source: draft.source || "Direct",
    status: "Confirmed",
    eventDate: draft.eventDate,
    guestsExpected: Number(draft.guestsExpected) || 0,
    packageId: draft.packageId || "",
    notes: draft.notes || "",
    createdAt: new Date().toISOString(),
  };

  const halls = (draft.halls || []).map((h) => {
    const hall = state.halls.find((x) => x.id === h.hallId);
    return {
      id: uid("hr"),
      bookingId: booking.id,
      hallId: h.hallId,
      date: h.date,
      slotType: h.slotType,
      start: h.start,
      end: h.end,
      setupHours: hall?.setupHours || 0,
      teardownHours: hall?.teardownHours || 0,
      status: "Confirmed",
    };
  });

  const rooms = (draft.rooms || []).map((r) => ({
    id: uid("rr"),
    bookingId: booking.id,
    roomId: r.roomId,
    guestId: guest.id,
    checkIn: r.checkIn,
    checkOut: r.checkOut,
    adults: Number(r.adults) || 1,
    children: Number(r.children) || 0,
    extraBed: Number(r.extraBed) || 0,
    status: "Reserved",
    source: draft.source || "Direct",
  }));

  rooms.forEach((r) => {
    state.rooms = state.rooms.map((room) =>
      room.id === r.roomId && room.status === "Available" ? { ...room, status: "Reserved" } : room
    );
  });

  const folio = { id: uid("fo"), bookingId: booking.id, discount: Number(draft.discount) || 0, taxPercent: state.property.taxPercent, status: "Open" };
  const lines = (draft.lines || []).map((l) => ({ ...l, id: l.id || uid("ln"), folioId: folio.id }));

  state.bookings.unshift(booking);
  state.hallReservations.push(...halls);
  state.roomReservations.push(...rooms);
  state.folios.unshift(folio);
  state.folioLines.push(...lines);

  if (halls.length) {
    state.events.unshift({
      id: uid("ev"),
      bookingId: booking.id,
      name: `${guest.name} · ${booking.type}`,
      date: booking.eventDate,
      tasks: ["Hall", "Rooms", "Catering", "Decoration", "Photography", "DJ", "Parking", "Security", "Stage"].map(
        (name, i) => ({
          id: `t${i}`,
          name,
          status: name === "Hall" || (name === "Rooms" && rooms.length) ? "Done" : "Pending",
          assignee: "",
        })
      ),
    });
  }

  const advance = Number(draft.advance) || 0;
  if (advance > 0) {
    state.payments.unshift({
      id: uid("pay"),
      folioId: folio.id,
      bookingId: booking.id,
      amount: advance,
      method: draft.paymentMode || "Cash",
      type: "Advance",
      at: new Date().toISOString(),
      ref: draft.paymentRef || "",
    });
    state.invoices.unshift({
      id: uid("inv"),
      number: seqNo(state.invoices, "number", "AR"),
      type: "Advance receipt",
      bookingId: booking.id,
      folioId: folio.id,
      at: new Date().toISOString(),
      status: "Issued",
    });
  }

  state.invoices.unshift({
    id: uid("inv"),
    number: seqNo(state.invoices, "number", "TX"),
    type: "Tax invoice",
    bookingId: booking.id,
    folioId: folio.id,
    at: new Date().toISOString(),
    status: "Draft",
  });

  audit(state, "Booking created", booking.number, `${guest.name} · ${booking.type}`);
  persist(state);
  return { state: load(), booking };
}

export function addPayment(folioId, payload) {
  const state = load();
  const folio = state.folios.find((f) => f.id === folioId);
  const pay = {
    id: uid("pay"),
    folioId,
    bookingId: folio?.bookingId,
    amount: Number(payload.amount) || 0,
    method: payload.method || "Cash",
    type: payload.type || "Payment",
    at: new Date().toISOString(),
    ref: payload.ref || "",
  };
  state.payments.unshift(pay);
  const prefix = pay.type === "Refund" ? "RF" : "RC";
  state.invoices.unshift({
    id: uid("inv"),
    number: seqNo(state.invoices, "number", prefix),
    type: pay.type === "Refund" ? "Refund receipt" : "Payment receipt",
    bookingId: folio?.bookingId,
    folioId,
    at: pay.at,
    status: "Issued",
  });
  if (pay.type === "Refund") {
    const bk = state.bookings.find((b) => b.id === folio?.bookingId);
    if (bk) bk.status = "Refunded";
  }
  const { totals } = bookingFolio(state, folio?.bookingId);
  if (totals.balance <= 0 && folio) folio.status = "Settled";
  audit(
    state,
    pay.type === "Refund" ? "Refund posted" : "Payment recorded",
    folio?.bookingId,
    `${pay.method} ${pay.amount}`
  );
  return persist(state);
}

export function setFolioDiscount(folioId, discount) {
  const state = load();
  const folio = state.folios.find((f) => f.id === folioId);
  const prev = folio?.discount;
  if (folio) folio.discount = Number(discount) || 0;
  audit(state, "Booking updated", folio?.bookingId, `Discount ${prev} → ${folio?.discount}`, {
    oldValue: prev,
    newValue: folio?.discount,
  });
  return persist(state);
}

export function cancelBooking(bookingId, refund) {
  const state = load();
  const bk = state.bookings.find((b) => b.id === bookingId);
  if (!bk) return state;
  bk.status = "Cancelled";
  state.hallReservations = state.hallReservations.map((r) =>
    r.bookingId === bookingId ? { ...r, status: "Cancelled" } : r
  );
  state.roomReservations = state.roomReservations.map((r) =>
    r.bookingId === bookingId ? { ...r, status: "Cancelled" } : r
  );
  const folio = state.folios.find((f) => f.bookingId === bookingId);
  if (folio) folio.status = "Cancelled";
  if (refund && folio) {
    state.payments.unshift({
      id: uid("pay"),
      folioId: folio.id,
      bookingId,
      amount: Number(refund),
      method: "Bank transfer",
      type: "Refund",
      at: new Date().toISOString(),
      ref: "Cancellation",
    });
  }
  audit(state, "Booking cancelled", bk.number, refund ? `Refund ${refund}` : "No refund");
  return persist(state);
}

export function checkInRoom(resId) {
  const state = load();
  const res = state.roomReservations.find((r) => r.id === resId);
  if (res) {
    res.status = "Occupied";
    state.rooms = state.rooms.map((r) => (r.id === res.roomId ? { ...r, status: "Occupied" } : r));
    audit(state, "Check-in", res.roomId, res.guestId);
  }
  return persist(state);
}

export function checkOutRoom(resId) {
  const state = load();
  const res = state.roomReservations.find((r) => r.id === resId);
  if (res) {
    res.status = "Checked out";
    state.rooms = state.rooms.map((r) => (r.id === res.roomId ? { ...r, status: "Dirty" } : r));
    audit(state, "Check-out", res.roomId, "Status → Dirty");
  }
  return persist(state);
}

export function transferRoom(resId, newRoomId) {
  const state = load();
  const res = state.roomReservations.find((r) => r.id === resId);
  if (!res) return { error: "Stay not found" };
  const clash = roomClash(state.roomReservations, newRoomId, res.checkIn, res.checkOut, res.id);
  if (clash) return { error: "Target room is not free for this stay." };
  const prev = res.roomId;
  state.rooms = state.rooms.map((r) => (r.id === prev ? { ...r, status: "Dirty" } : r));
  res.roomId = newRoomId;
  state.rooms = state.rooms.map((r) => (r.id === newRoomId ? { ...r, status: res.status === "Occupied" ? "Occupied" : "Reserved" } : r));
  audit(state, "Room transfer", res.bookingId, `${prev} → ${newRoomId}`);
  persist(state);
  return { state: load() };
}

export function setTaskStatus(eventId, taskId, status) {
  const state = load();
  state.events = state.events.map((e) =>
    e.id === eventId ? { ...e, tasks: e.tasks.map((t) => (t.id === taskId ? { ...t, status } : t)) } : e
  );
  return persist(state);
}

export function addVendor(vendor) {
  const state = load();
  vendor.id = uid("v");
  vendor.status = "Active";
  state.vendors.unshift(vendor);
  audit(state, "Vendor added", vendor.name, vendor.trade);
  return persist(state);
}

export function addPO(po) {
  const state = load();
  const row = {
    id: uid("po"),
    number: seqNo(state.purchaseOrders, "number", "PO"),
    vendorId: po.vendorId,
    bookingId: po.bookingId || "",
    service: po.service,
    amount: Number(po.amount) || 0,
    status: "Confirmed",
    at: new Date().toISOString(),
  };
  state.purchaseOrders.unshift(row);
  audit(state, "Purchase order", row.number, po.service);
  return persist(state);
}

export function addCatering(order) {
  const state = load();
  state.cateringOrders.unshift({ id: uid("cat"), ...order });
  return persist(state);
}

export function addEnquiry(enq) {
  const state = load();
  if (enq.date) {
    const avail = publicAvailability(state, enq.hall, enq.date);
    if (avail.blocked) return { error: avail.message };
  }

  const guest = {
    id: uid("g"),
    name: enq.name,
    phone: enq.phone,
    email: enq.email || "",
    nationality: "India",
    idProof: { type: "", number: "" },
    address: "",
    company: "",
    emergency: "",
    preferences: "",
    tags: ["Website"],
  };
  state.guests.unshift(guest);
  const booking = {
    id: uid("bk"),
    number: seqNo(state.bookings, "number", "ENQ"),
    guestId: guest.id,
    type: enq.type || "Event",
    source: "Website",
    status: "Enquiry",
    eventDate: enq.date,
    guestsExpected: Number(enq.guests) || 0,
    packageId: "",
    notes: enq.message || "",
    createdAt: new Date().toISOString(),
  };
  state.bookings.unshift(booking);
  state.enquiries.unshift({
    id: uid("en"),
    bookingId: booking.id,
    name: enq.name,
    phone: enq.phone,
    date: enq.date,
    hall: enq.hall || "",
    guests: enq.guests,
    message: enq.message,
    status: "Open",
  });
  state.notifications.unshift({
    id: uid("n"),
    at: new Date().toISOString(),
    channel: "WhatsApp",
    title: "Online enquiry",
    body: `${enq.name} · ${enq.date}`,
  });
  audit(state, "Enquiry received", booking.number, enq.name);
  persist(state);
  return { state: load(), booking };
}

export function issueDocument(bookingId, type) {
  const state = load();
  const folio = state.folios.find((f) => f.bookingId === bookingId);
  const codes = {
    Quotation: "QT",
    "Proforma invoice": "PF",
    "Tax invoice": "TX",
    "Advance receipt": "AR",
    "Payment receipt": "RC",
    "Credit note": "CN",
    "Debit note": "DN",
    "Refund receipt": "RF",
    "Final invoice": "FN",
  };
  const inv = {
    id: uid("inv"),
    number: seqNo(state.invoices, "number", codes[type] || "DOC"),
    type,
    bookingId,
    folioId: folio?.id || "",
    at: new Date().toISOString(),
    status: "Issued",
  };
  state.invoices.unshift(inv);
  audit(state, "Document issued", inv.number, type);
  persist(state);
  return { state: load(), invoice: inv };
}

const MAX_DOC = 8 * 1024 * 1024;

export async function attachDocument({ bookingId, guestId, typeId, file }) {
  if (!file) return { error: "Choose a file." };
  if (file.size > MAX_DOC) return { error: "Each file must be under 8 MB." };
  const ok = /^(image\/|application\/pdf)/.test(file.type) || /\.(pdf|jpe?g|png|webp)$/i.test(file.name);
  if (!ok) return { error: "Upload PDF or image (JPG, PNG, WebP)." };
  const spec = specById(typeId);
  const id = uid("doc");
  await putBlob(id, file);
  const state = load();
  const rec = {
    id,
    bookingId: bookingId || "",
    guestId: guestId || "",
    typeId,
    label: spec?.label || typeId,
    scope: spec?.scope || "both",
    required: !!spec?.required,
    fileName: file.name,
    mime: file.type,
    size: file.size,
    uploadedAt: new Date().toISOString(),
    verified: false,
    storage: "This computer",
  };
  state.documents = [rec, ...(state.documents || [])];
  audit(state, "Document uploaded", rec.label, rec.fileName);
  persist(state);
  return { state: load(), doc: rec };
}

export async function attachMany(bookingId, guestId, pending) {
  let state = load();
  for (const item of pending || []) {
    if (!item.file) continue;
    const out = await attachDocument({ bookingId, guestId, typeId: item.typeId, file: item.file });
    if (out.error) return out;
    state = out.state;
  }
  return { state };
}

export async function removeDocument(id) {
  await deleteBlob(id);
  const state = load();
  const rec = (state.documents || []).find((d) => d.id === id);
  state.documents = (state.documents || []).filter((d) => d.id !== id);
  audit(state, "Document deleted", rec?.label || id, rec?.fileName || "");
  return persist(state);
}

export function verifyDocument(id, verified = true) {
  const state = load();
  state.documents = (state.documents || []).map((d) => (d.id === id ? { ...d, verified } : d));
  audit(state, verified ? "Document verified" : "Verification cleared", id, "");
  return persist(state);
}

export { folioTotals };
