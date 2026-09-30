/** Shared staff-desk records for the phone app. Desktop and phone read the same snapshot. */

import {
  addPaymentApi,
  approveRefundApi,
  cancelBookingApi,
  createBooking,
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
  return PHONE_HALL[code] || "imperial";
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
      roomId: (booking.roomNumbers || []).length ? "deluxe" : "",
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
      hall: phoneHall(booking?.hallCodes),
      amount: money(payment.amount),
      mode: payment.method || "Cash",
      date: day(payment.paidAt),
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
  }));

  const documents = (snap?.documents || []).map((doc) => {
    const booking = bookingById.get(doc.bookingId);
    return {
      id: `api-d-${doc.id}`,
      serverId: doc.id,
      bookingNo: booking?.number || "",
      kind: doc.typeCode || "File",
      name: doc.fileName || "Document",
    };
  });

  const occupied = { suite: 0, deluxe: 0, standard: 0 };
  rooms.forEach((room) => {
    const status = String(room.status || "").toLowerCase();
    if (!status.includes("occup") && status !== "reserved") return;
    occupied[roomBucket(room.typeName)] += 1;
  });

  return {
    serverHalls: halls.map((hall) => ({ id: hall.id, code: hall.code, name: hall.name })),
    serverRooms: rooms.map((room) => ({
      id: room.id,
      number: room.number,
      typeName: room.typeName,
      status: room.status,
    })),
    bookings,
    payments,
    expenses,
    refunds,
    guests,
    documents,
    occupied,
  };
}

function hallServerId(state, hallId) {
  const code = HALL_CODE[hallId] || "IMP";
  const hall = (state.serverHalls || []).find((item) => String(item.code).toUpperCase() === code);
  return hall?.id || null;
}

function roomServerId(state, roomType) {
  const bucket = roomBucket(roomType);
  const room = (state.serverRooms || []).find((item) => {
    const status = String(item.status || "").toLowerCase();
    return roomBucket(item.typeName) === bucket && (status === "available" || status === "");
  });
  return room?.id || null;
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
    const hallId = hallServerId(state, booking.hallId);
    const roomId = booking.roomId ? roomServerId(state, booking.roomId) : null;
    await createBooking({
      guestId: guest.id,
      type: booking.roomId ? "Room" : "Event",
      source: "Phone",
      eventDate: booking.date,
      guestsExpected: Number(booking.guests) || 0,
      notes: booking.package || "",
      discount: 0,
      hallIds: hallId ? [hallId] : [],
      roomIds: roomId ? [roomId] : [],
      slotType: String(booking.package || "").toLowerCase().includes("half") ? "half-day" : "full-day",
      roomCheckIn: booking.roomId ? booking.date : null,
      roomCheckOut: null,
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

  if (action.type === "add-payment") {
    const booking = bookingOf(state, action.bookingId);
    if (!booking?.serverId) throw new Error("Save the booking on the staff desk before taking a payment.");
    await addPaymentApi(booking.serverId, {
      amount: Number(action.amount) || 0,
      method: action.mode || "Cash",
      type: "Payment",
      paidOn: action.date || null,
      refNo: null,
    });
    return;
  }

  if (action.type === "cancel-booking" || action.type === "delete-booking") {
    const booking = bookingOf(state, action.id);
    if (!booking?.serverId) return;
    await cancelBookingApi(booking.serverId);
    return;
  }

  if (action.type === "add-guest") {
    const guest = action.guest || {};
    await createGuest({
      name: guest.name,
      phone: guest.phone || null,
      email: guest.email || null,
      address: guest.address || null,
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
