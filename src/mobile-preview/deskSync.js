/** Shared staff-desk records for the phone app. Desktop and phone read the same snapshot. */

import {
  addPaymentApi,
  approveRefundApi,
  cancelBookingApi,
  deleteBookingApi,
  createBooking,
  setBookingGst,
  updateBookingApi,
  createExpenseApi,
  createGuest,
  createRefundApi,
  updateGuest,
  verifyExpenseApi,
} from "../api/ops.js";

const HALL_CODE = { imperial: "IMP", garden: "GRD", heritage: "HER", retreat: "HER" };
const PHONE_HALL = { IMP: "imperial", GRD: "garden", HER: "heritage" };

function day(value) {
  const text = String(value || "");
  return text.length >= 10 ? text.slice(0, 10) : "";
}

function money(value) {
  return Math.round(Number(value) || 0);
}

function phoneHall(codes) {
  const code = String((codes || [])[0] || "").toUpperCase();
  if (!code) return "";
  return PHONE_HALL[code] || "";
}

function phoneRoomId(numbers, rooms) {
  const room = (rooms || []).find((item) => (numbers || []).some((number) => String(item.number) === String(number)));
  if (!room) return "";
  return roomBucket(room.typeName);
}

function nextDay(iso) {
  const [year, month, day] = String(iso || "").split("-").map(Number);
  if (!year || !month || !day) return iso || null;
  const date = new Date(year, month - 1, day + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function refundStatus(status) {
  const value = String(status || "").toLowerCase();
  if (value === "paid" || value === "processed") return "processed";
  if (value === "approved") return "approved";
  if (value === "rejected") return "rejected";
  return "requested";
}

function roomBucket(typeName) {
  const name = String(typeName || "").toLowerCase();
  if (name.includes("suite") || name.includes("family")) return "suite";
  if (name.includes("deluxe")) return "deluxe";
  return "standard";
}

export function snapshotToPhone(snap) {
  const halls = snap?.halls || [];
  const rooms = snap?.rooms || [];
  const serverBookings = snap?.bookings || [];
  const bookingById = new Map(serverBookings.map((booking) => [booking.id, booking]));
  const guestById = new Map((snap?.guests || []).map((guest) => [guest.id, guest]));
  const guestCounts = {};
  serverBookings.forEach((booking) => {
    if (String(booking.status || "").toLowerCase() === "cancelled") return;
    guestCounts[booking.guestId] = (guestCounts[booking.guestId] || 0) + 1;
  });

  const extrasByBooking = new Map();
  for (const line of snap?.folioLines || []) {
    const bucket = extrasByBooking.get(line.bookingId) || [];
    bucket.push({
      id: line.id,
      category: line.category,
      description: line.description || "",
      qty: Number(line.qty) || 0,
      unitPrice: Number(line.unitPrice) || 0,
      amount: Math.round(Number(line.amount) || 0),
    });
    extrasByBooking.set(line.bookingId, bucket);
  }

  const bookings = serverBookings.map((booking) => {
    const paid = money(booking.paymentsTotal);
    const charges = money(booking.chargesTotal);
    const guest = guestById.get(booking.guestId);
    return {
      id: `api-${booking.id}`,
      serverId: booking.id,
      guestServerId: booking.guestId,
      no: booking.number || "",
      guest: booking.guestName || guest?.name || "Guest",
      phone: booking.guestPhone || guest?.phone || "",
      email: guest?.email || "",
      gst: guest?.gstin || "",
      address: guest?.address || "",
      hallId: phoneHall(booking.hallCodes),
      roomId: phoneRoomId(booking.roomNumbers, rooms),
      roomNumbers: booking.roomNumbers || [],
      slot: phoneRoomId(booking.roomNumbers, rooms) && !phoneHall(booking.hallCodes) ? "Night" : (booking.slotType || ""),
      date: day(booking.eventDate),
      guests: booking.guestsExpected || 0,
      status: booking.status || "Confirmed",
      total: charges || paid,
      paid,
      package: booking.notes || "Hall",
      requirements: [],
      approval: "done",
      createdBy: "",
      stay: "",
      gstMode: booking.gstMode === "with" ? "with" : "without",
      charges: extrasByBooking.get(booking.id) || [],
    };
  });

  const payments = (snap?.payments || []).map((payment) => {
    const booking = bookingById.get(payment.bookingId);
    const kind = String(payment.type || "").toLowerCase().includes("refund") ? "refund" : "collection";
    return {
      id: `api-p-${payment.id}`,
      serverId: payment.id,
      bookingNo: booking?.number || "",
      guest: booking?.guestName || "",
      hall: phoneHall(booking?.hallCodes) || phoneRoomId(booking?.roomNumbers, rooms),
      amount: money(payment.amount),
      mode: payment.method || "Cash",
      date: day(payment.paidAt),
      at: payment.paidAt || "",
      type: payment.type || "Payment",
      ref: payment.refNo || "",
      kind,
    };
  });

  const expenses = (snap?.expenses || []).map((expense) => ({
    id: `api-e-${expense.id}`,
    serverId: expense.id,
    date: day(expense.spentOn),
    dept: expense.category || "Hotel",
    type: expense.description || "Expense",
    by: expense.createdByName || "",
    taken: expense.vendor || "",
    amount: money(expense.amount),
    mode: expense.paymentMethod || "Cash",
    note: expense.notes || "",
    file: "",
    status: expense.verified ? "approved" : "pending",
    addedBy: expense.createdById ? `api-${expense.createdById}` : "",
  }));

  const refunds = (snap?.refunds || []).map((refund) => {
    const booking = bookingById.get(refund.bookingId);
    return {
      id: `api-rf-${refund.id}`,
      serverId: refund.id,
      bookingId: booking ? `api-${booking.id}` : "",
      bookingNo: booking?.number || "",
      guest: booking?.guestName || "",
      amount: money(refund.amount),
      mode: "UPI",
      reason: refund.reason || "",
      status: refundStatus(refund.status),
      by: refund.requestedByName || "",
    };
  });

  const guests = (snap?.guests || []).map((guest) => ({
    id: `api-g-${guest.id}`,
    serverId: guest.id,
    name: guest.name || "",
    phone: guest.phone || "",
    email: guest.email || "",
    address: guest.address || "",
    bookings: guestCounts[guest.id] || 0,
    leadStatus: guest.leadStatus || "",
    leadSource: guest.leadSource || "",
    notes: guest.notes || "",
  }));

  const documents = (snap?.documents || []).map((doc) => {
    const booking = bookingById.get(doc.bookingId);
    return {
      id: `api-d-${doc.id}`,
      serverId: doc.id,
      bookingNo: booking?.number || "",
      guestId: doc.guestId || null,
      kind: doc.typeCode || "File",
      name: doc.fileName || "Document",
      createdAt: doc.createdAt || "",
    };
  });

  const reservedNumbers = new Set();
  serverBookings.forEach((booking) => {
    if (String(booking.status || "").toLowerCase() === "cancelled") return;
    (booking.roomNumbers || []).forEach((number) => reservedNumbers.add(String(number)));
  });
  const occupied = { suite: 0, deluxe: 0, standard: 0 };
  rooms.forEach((room) => {
    const status = String(room.status || "").toLowerCase();
    const held = reservedNumbers.has(String(room.number || ""));
    if (!held && !status.includes("occup") && status !== "reserved") return;
    occupied[roomBucket(room.typeName)] += 1;
  });

  return {
    serverHalls: halls.map((hall) => ({ id: hall.id, code: hall.code, name: hall.name })),
    serverRooms: rooms.map((room) => ({
      id: room.id,
      number: room.number,
      typeName: room.typeName,
      status: room.status,
      baseRate: Number(room.baseRate) || 0,
    })),
    bookings,
    payments,
    expenses,
    refunds,
    guests,
    documents,
    occupied,
    notices: (snap?.notices || []).map((notice) => ({
      id: notice.id,
      title: notice.title || "Update",
      body: notice.body || "",
    })),
  };
}

function hallServerId(state, hallId) {
  const code = HALL_CODE[hallId] || "IMP";
  const hall = (state.serverHalls || []).find((item) => String(item.code).toUpperCase() === code);
  return hall?.id || null;
}

function roomServerId(state, roomType, date, roomNumber) {
  const bucket = roomBucket(roomType);
  const held = new Set();
  (state.bookings || []).forEach((booking) => {
    if (String(booking.status || "").toLowerCase() === "cancelled") return;
    if (date && booking.date && booking.date !== date) return;
    (booking.roomNumbers || []).forEach((number) => held.add(String(number)));
  });
  const rooms = (state.serverRooms || [])
    .filter((item) => roomBucket(item.typeName) === bucket && !held.has(String(item.number)))
    .sort((a, b) => String(a.number).localeCompare(String(b.number), undefined, { numeric: true }));
  if (roomNumber) return rooms.find((item) => String(item.number) === String(roomNumber))?.id || null;
  return rooms[0]?.id || null;
}

function bookingOf(state, id) {
  return (state.bookings || []).find((booking) => booking.id === id) || null;
}

export async function pushPhoneAction(action, state) {
  if (action.type === "add-booking") {
    const booking = action.booking || {};
    const guest = await createGuest({
      name: booking.guest || "Guest",
      phone: booking.phone || null,
      email: booking.email || null,
      address: booking.address || null,
      gstin: booking.gst || null,
    });
    const roomOnly = Boolean(booking.roomId) && !booking.hallId;
    const hallId = roomOnly ? null : hallServerId(state, booking.hallId);
    const roomId = booking.roomId ? roomServerId(state, booking.roomId, booking.date, booking.roomNumber) : null;
    if (booking.roomId && !roomId) {
      throw new Error(booking.roomNumber ? `Room ${booking.roomNumber} is already booked that night.` : "No free room of that type is available. Pick another date.");
    }
    await createBooking({
      guestId: guest.id,
      type: roomOnly ? "Room" : "Event",
      source: "Phone",
      eventDate: booking.date,
      guestsExpected: Number(booking.guests) || 0,
      notes: booking.package || "",
      discount: 0,
      hallIds: hallId ? [hallId] : [],
      roomIds: roomId ? [roomId] : [],
      slotType: roomOnly ? "full-day" : (booking.slot || (String(booking.package || "").toLowerCase().includes("half") ? "half-day" : "full-day")),
      roomCheckIn: booking.roomId ? booking.date : null,
      roomCheckOut: booking.roomId ? nextDay(booking.date) : null,
      gstMode: booking.gstMode === "with" ? "with" : "without",
    });
    return;
  }

  if (action.type === "update-booking") {
    const booking = action.booking || {};
    if (booking.guestServerId) {
      await updateGuest(booking.guestServerId, {
        name: booking.guest || "Guest",
        phone: booking.phone || null,
        email: booking.email || null,
        address: booking.address || null,
        gstin: booking.gst || null,
      });
    }
    if (booking.serverId) {
      await updateBookingApi(booking.serverId, {
        eventDate: booking.date || null,
        guestsExpected: Number(booking.guests) || 0,
        notes: booking.package || "",
      });
    }
    return;
  }

  if (action.type === "set-gst") {
    const booking = bookingOf(state, action.id);
    if (!booking?.serverId) return;
    await setBookingGst(booking.serverId, action.gstMode === "with" ? "with" : "without");
    return;
  }

  if (action.type === "add-payment") {
    const booking = bookingOf(state, action.bookingId);
    if (!booking?.serverId) throw new Error("Save the booking on the staff desk before taking a payment.");
    await addPaymentApi(booking.serverId, {
      amount: Number(action.amount) || 0,
      method: action.mode || "Cash",
      type: action.payType || "Payment",
      paidOn: action.date || null,
      refNo: action.ref || null,
    });
    return;
  }

  if (action.type === "cancel-booking") {
    const booking = bookingOf(state, action.id);
    if (!booking?.serverId) return;
    await cancelBookingApi(booking.serverId);
    return;
  }

  if (action.type === "delete-booking") {
    const booking = bookingOf(state, action.id);
    if (!booking?.serverId) return;
    await deleteBookingApi(booking.serverId);
    return;
  }

  if (action.type === "add-guest") {
    const guest = action.guest || {};
    await createGuest({
      name: guest.name,
      phone: guest.phone || null,
      email: guest.email || null,
      address: guest.address || null,
      leadStatus: guest.leadStatus || null,
      leadSource: guest.leadSource || null,
      notes: guest.notes || null,
    });
    return;
  }

  if (action.type === "update-guest") {
    const guest = action.guest || {};
    if (!guest.serverId) throw new Error("This guest is not on the staff desk yet.");
    await updateGuest(guest.serverId, {
      name: guest.name,
      phone: guest.phone || null,
      email: guest.email || null,
      address: guest.address || null,
      leadStatus: guest.leadStatus || "",
      leadSource: guest.leadSource || "",
      notes: guest.notes || "",
    });
    return;
  }

  if (action.type === "add-expense") {
    const expense = action.expense || {};
    const created = await createExpenseApi({
      category: expense.dept || "Hotel",
      description: expense.type || "Expense",
      amount: Number(expense.amount) || 0,
      spentOn: expense.date || null,
      paymentMethod: expense.mode || "Cash",
      vendor: expense.taken || null,
      notes: expense.note || null,
    });
    if (state.user?.role === "Owner" && created?.id) {
      await verifyExpenseApi(created.id, true);
    }
    return;
  }

  if (action.type === "verify-expense" || action.type === "approve-expense") {
    const expense = (state.expenses || []).find((item) => item.id === action.id);
    if (!expense?.serverId) return;
    await verifyExpenseApi(expense.serverId, true);
    return;
  }

  if (action.type === "request-refund") {
    const booking = bookingOf(state, action.bookingId);
    if (!booking?.serverId) throw new Error("Save the booking on the staff desk before requesting a refund.");
    await createRefundApi(booking.serverId, {
      amount: Number(action.amount) || 0,
      reason: action.reason || "",
    });
    return;
  }

  if (action.type === "approve-refund" || action.type === "process-refund") {
    const refund = (state.refunds || []).find((item) => item.id === action.id);
    if (!refund?.serverId) return;
    await approveRefundApi(refund.serverId, action.type === "process-refund" ? "Paid" : "Approved", "");
  }
}

const SERVER_ACTIONS = new Set([
  "add-booking",
  "update-booking",
  "set-gst",
  "add-payment",
  "cancel-booking",
  "delete-booking",
  "add-guest",
  "update-guest",
  "add-expense",
  "verify-expense",
  "approve-expense",
  "request-refund",
  "approve-refund",
  "process-refund",
]);

export function savesToDesk(type) {
  return SERVER_ACTIONS.has(type);
}
