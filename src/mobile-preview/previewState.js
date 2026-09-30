export const TODAY = "2026-09-30";
export const ROOM_STOCK = 22;

export const HALLS = [
  { id: "imperial", name: "Imperial Ballroom", meta: "Capacity 3000", photo: "/site/images/gallery/imperial-hall-ceremony.jpg", half: 300000, full: 450000 },
  { id: "garden", name: "Garden Pavilion", meta: "Capacity 800", photo: "/site/images/gallery/aerial-dusk-grove.jpg", half: 125000, full: 250000 },
  { id: "heritage", name: "Heritage Courtyard (MINI)", meta: "Capacity 500", photo: "/site/images/visit-building.jpg", half: 125000, full: 200000 },
  { id: "retreat", name: "The Royal Family Retreat", meta: "4 rooms + kitchen", photo: "/site/images/retreat-family-lobby.jpg", half: 30000, full: 30000 },
];

export const ROOM_TYPES = [
  { id: "suite", name: "Suite room AC", count: 2, rate: 5500, ac: true },
  { id: "deluxe", name: "Deluxe AC", count: 12, rate: 3500, ac: true },
  { id: "standard", name: "Standard AC", count: 8, rate: 2500, ac: true },
];

const NAMES = ["Kiran", "Meera", "Arun", "Latha", "Suresh", "Divya", "Naveen", "Pooja", "Hari", "Swathi"];

export function digits(phone) {
  return String(phone || "").replace(/\D/g, "");
}

/** Phone app sign-in. The staff desk at /staff keeps its own accounts. */
export const PHONE_APP_LOGIN = {
  email: "gayatriconventionandresorts@gmail.com",
  password: "gayatri123",
};

export function phoneAppUser(email, password) {
  const sameEmail = String(email || "").trim().toLowerCase() === PHONE_APP_LOGIN.email;
  const samePassword = String(password || "") === PHONE_APP_LOGIN.password;
  if (!sameEmail || !samePassword) return null;
  return {
    id: "phone-owner",
    name: "Gayatri",
    role: "Owner",
    email: PHONE_APP_LOGIN.email,
    phone: "",
  };
}

/** Map a /staff account onto the phone screens. */
export function phoneUserFromStaff(user) {
  const role = String(user?.role || "").toLowerCase();
  const mapped = role === "admin" || role === "owner" || role === "administrator"
    ? "Owner"
    : role === "manager"
      ? "Manager"
      : "Receptionist";
  return {
    id: user?.id || user?.email || "staff",
    name: user?.name || user?.email || "Staff",
    role: mapped,
    email: user?.email || "",
    phone: "",
  };
}

const MANAGER_KEYS = new Set([
  "dash.collection", "dash.bookings", "dash.pending", "dash.rooms",
  "booking.create", "booking.edit", "booking.review", "room.allocate", "hall.allocate",
  "payment.receive", "invoice.generate", "invoice.print", "refund.verify",
  "expense.add", "expense.verify", "report.daily", "report.monthly",
  "guest.add", "guest.edit",
]);

const DESK_KEYS = new Set([
  "dash.bookings", "dash.checkin", "dash.checkout",
  "booking.create", "room.allocate", "guest.add", "guest.edit",
  "payment.receive", "invoice.print", "report.today",
  "expense.submit", "refund.request",
]);

export function allow(role, key) {
  if (role === "Owner") return true;
  if (role === "Manager") return MANAGER_KEYS.has(key);
  if (role === "Receptionist") return DESK_KEYS.has(key);
  return false;
}

const MANAGER_SCREENS = new Set(["home", "reservations", "new", "calendar", "detail", "rooms", "room-avail", "pay", "guests", "documents", "reports", "today", "period", "pay-history", "register", "expense", "expense-list", "invoice", "more", "refunds"]);
const DESK_SCREENS = new Set(["home", "reservations", "new", "calendar", "detail", "rooms", "room-avail", "pay", "guests", "documents", "today", "pay-history", "invoice", "more", "expense", "refunds"]);

export function screenAllowed(role, screen) {
  if (role === "Owner") return true;
  if (role === "Manager") return MANAGER_SCREENS.has(screen);
  if (role === "Receptionist") return DESK_SCREENS.has(screen);
  return false;
}

function filler(i) {
  const pending = i === 0;
  return {
    id: `f${i}`,
    no: `BK-2026-10${String(i).padStart(2, "0")}`,
    guest: NAMES[i],
    phone: `90000010${String(i).padStart(2, "0")}`,
    email: "",
    gst: "",
    address: "Palagummi",
    hallId: i % 2 ? "garden" : "heritage",
    roomId: "",
    date: TODAY,
    guests: 2,
    status: pending ? "Pending" : "Confirmed",
    total: pending ? 50000 : 20000,
    paid: pending ? 40000 : 20000,
    package: "Hall",
    requirements: [],
    approval: "done",
    createdBy: "u1",
    stay: "",
  };
}

export const initialState = {
  user: null,
  occupied: { suite: 2, deluxe: 6, standard: 0 },
  bookings: [
    { id: "b1", no: "BK-2026-0001", guest: "Ramesh Kumar", phone: "9876543210", email: "ramesh@gayatri.com", gst: "37ABCDE1234F1Z5", address: "Razole", hallId: "imperial", roomId: "", date: TODAY, guests: 2, status: "Confirmed", total: 450000, paid: 350000, package: "Half Day", requirements: ["Decoration", "Catering", "Audio System"], approval: "done", createdBy: "u1", stay: "in" },
    { id: "b2", no: "BK-2026-0002", guest: "Priya Sharma", phone: "9849600111", email: "priya@email.com", gst: "", address: "Amalapuram", hallId: "garden", roomId: "", date: TODAY, guests: 8, status: "Pending", total: 250000, paid: 210000, package: "Full Day", requirements: ["Catering"], approval: "manager", createdBy: "u3", stay: "" },
    { id: "b3", no: "BK-2026-0003", guest: "Sridhar Reddy", phone: "9849600222", email: "", gst: "", address: "Kakinada", hallId: "heritage", roomId: "", date: TODAY, guests: 6, status: "Confirmed", total: 200000, paid: 180000, package: "Half Day", requirements: [], approval: "done", createdBy: "u1", stay: "" },
    { id: "b4", no: "BK-2026-0004", guest: "Anita Verma", phone: "9849600333", email: "", gst: "", address: "Rajahmundry", hallId: "retreat", roomId: "", date: "2026-09-29", guests: 4, status: "Cancelled", total: 30000, paid: 0, package: "Family stay", requirements: [], approval: "done", createdBy: "u1", stay: "out" },
    ...Array.from({ length: 10 }, (_, i) => filler(i)),
  ],
  payments: [
    { id: "p1", bookingNo: "BK-2026-0001", guest: "Ramesh Kumar", hall: "Imperial Ballroom", amount: 10000, mode: "Cash", date: TODAY, kind: "collection" },
    { id: "p2", bookingNo: "BK-2026-0002", guest: "Priya Sharma", hall: "Garden Pavilion", amount: 10000, mode: "UPI", date: TODAY, kind: "collection" },
    { id: "p3", bookingNo: "BK-2026-0003", guest: "Sridhar Reddy", hall: "Heritage Courtyard (MINI)", amount: 5000, mode: "Bank", date: TODAY, kind: "collection" },
    { id: "r1", bookingNo: "BK-2026-0001", guest: "Ramesh Kumar", hall: "Imperial Ballroom", amount: 11000, mode: "UPI", date: TODAY, kind: "refund" },
    { id: "p4", bookingNo: "BK-2026-0001", guest: "Ramesh Kumar", hall: "Imperial Ballroom", amount: 100000, mode: "Cash", date: "2026-09-15", kind: "collection" },
    { id: "p5", bookingNo: "BK-2026-0002", guest: "Priya Sharma", hall: "Garden Pavilion", amount: 150000, mode: "UPI", date: "2026-09-15", kind: "collection" },
    { id: "p6", bookingNo: "BK-2026-0003", guest: "Sridhar Reddy", hall: "Heritage Courtyard (MINI)", amount: 80000, mode: "Card", date: "2026-09-15", kind: "collection" },
    { id: "p7", bookingNo: "BK-2026-0001", guest: "Ramesh Kumar", hall: "Imperial Ballroom", amount: 70000, mode: "Bank", date: "2026-09-12", kind: "collection" },
    { id: "p8", bookingNo: "BK-2026-0002", guest: "Priya Sharma", hall: "Garden Pavilion", amount: 15000, mode: "Advance", date: "2026-09-10", kind: "collection" },
    { id: "p9", bookingNo: "BK-2026-0003", guest: "Sridhar Reddy", hall: "Heritage Courtyard (MINI)", amount: 10000, mode: "Final", date: "2026-09-10", kind: "collection" },
    { id: "p10", bookingNo: "BK-2026-0001", guest: "Ramesh Kumar", hall: "Imperial Ballroom", amount: 80000, mode: "UPI", date: "2026-06-15", kind: "collection" },
    { id: "p11", bookingNo: "BK-2026-0002", guest: "Priya Sharma", hall: "Garden Pavilion", amount: 40000, mode: "Cash", date: "2026-04-15", kind: "collection" },
  ],
  expenses: [
    { id: "e1", date: TODAY, dept: "Hotel", type: "Diesel", by: "Owner", taken: "Pump", amount: 2000, mode: "Cash", note: "Generator diesel", file: "", status: "approved", addedBy: "u1" },
    { id: "e2", date: "2026-09-20", dept: "Food & Beverages", type: "Catering", by: "Vendor", taken: "Kitchen", amount: 40000, mode: "Bank", note: "", file: "catering-bill.pdf", status: "approved", addedBy: "u1" },
    { id: "e3", date: "2026-09-18", dept: "Office", type: "Staff", by: "Owner", taken: "Team", amount: 30000, mode: "UPI", note: "", file: "", status: "approved", addedBy: "u1" },
    { id: "e4", date: "2026-09-12", dept: "Utilities", type: "Electricity", by: "Owner", taken: "Board", amount: 20000, mode: "UPI", note: "", file: "power-bill.pdf", status: "approved", addedBy: "u1" },
    { id: "e5", date: "2026-09-10", dept: "Others", type: "Maintenance", by: "Ramesh", taken: "Vendor", amount: 18000, mode: "Cash", note: "", file: "", status: "approved", addedBy: "u1" },
    { id: "e6", date: "2026-09-08", dept: "Hotel", type: "Housekeeping", by: "Owner", taken: "Staff", amount: 10000, mode: "Cash", note: "", file: "", status: "approved", addedBy: "u1" },
    { id: "e7", date: TODAY, dept: "Hotel", type: "Supplies", by: "Receptionist", taken: "Store", amount: 1500, mode: "Cash", note: "Waiting for owner", file: "supplies-bill.pdf", status: "pending", addedBy: "u3" },
  ],
  refunds: [
    { id: "rf1", bookingId: "b2", bookingNo: "BK-2026-0002", guest: "Priya Sharma", amount: 5000, mode: "UPI", reason: "Date change", status: "requested", by: "Receptionist" },
  ],
  staff: [],
  settings: { property: "Gayatri Convention", refundNote: "A refund is paid only after the owner approves it." },
  guests: [
    { id: "g1", name: "Ramesh Kumar", phone: "9876543210", email: "ramesh@gayatri.com", address: "Razole", bookings: 4 },
    { id: "g2", name: "Priya Sharma", phone: "9849600111", email: "priya@email.com", address: "Amalapuram", bookings: 2 },
    { id: "g3", name: "Sridhar Reddy", phone: "9849600222", email: "", address: "Kakinada", bookings: 3 },
    { id: "g4", name: "Anita Verma", phone: "9849600333", email: "", address: "Rajahmundry", bookings: 1 },
  ],
  documents: [
    { id: "d1", bookingNo: "BK-2026-0001", kind: "ID Proof", name: "Aadhaar Card - Ramesh.pdf" },
    { id: "d2", bookingNo: "BK-2026-0001", kind: "Agreement", name: "Function agreement.pdf" },
  ],
};

export function inr(n) {
  const value = Math.round(Number(n) || 0);
  return `₹${value.toLocaleString("en-IN")}`;
}

export function balanceOf(booking) {
  return Math.max(0, (booking.total || 0) - (booking.paid || 0));
}

export function hallName(id) {
  return HALLS.find((h) => h.id === id)?.name || "Hall";
}

export function showDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${Number(d)} ${months[Number(m) - 1]} ${y}`;
}

function sum(rows) {
  return rows.reduce((n, row) => n + row.amount, 0);
}

export function rangeFor(key) {
  if (key === "today") return [TODAY, TODAY];
  if (key === "week") return ["2026-09-24", TODAY];
  if (key === "month") return ["2026-09-01", TODAY];
  if (key === "half") return ["2026-04-01", TODAY];
  if (key === "year") return ["2026-01-01", TODAY];
  return ["2026-09-01", TODAY];
}

export function inSpan(iso, from, to) {
  return iso >= from && iso <= to;
}

export function money(state, from, to) {
  const pay = state.payments.filter((p) => p.kind !== "refund" && inSpan(p.date, from, to));
  const refunds = state.payments.filter((p) => p.kind === "refund" && inSpan(p.date, from, to));
  const expenses = state.expenses.filter((e) => (e.status === "approved" || !e.status) && inSpan(e.date, from, to));
  const byMode = {};
  pay.forEach((p) => { byMode[p.mode] = (byMode[p.mode] || 0) + p.amount; });
  const revenue = sum(pay);
  const expense = sum(expenses);
  const refund = sum(refunds);
  return { revenue, expense, refund, net: revenue - refund, profit: revenue - refund - expense, byMode, pay, expenses };
}

export function kpis(state) {
  const month = money(state, "2026-09-01", TODAY);
  const today = money(state, TODAY, TODAY);
  const bookingsToday = state.bookings.filter((b) => b.date === TODAY && b.status !== "Cancelled").length;
  const pending = state.bookings.filter((b) => b.status !== "Cancelled").reduce((n, b) => n + balanceOf(b), 0);
  const occupied = Object.values(state.occupied).reduce((n, v) => n + v, 0);
  return {
    collectionToday: today.revenue,
    refundsToday: today.refund,
    netToday: today.net,
    bookingsToday,
    pending,
    revenueMonth: month.revenue,
    expensesMonth: month.expense,
    profit: month.revenue - month.expense,
    occupied,
    available: ROOM_STOCK - occupied,
    todayModes: today.byMode,
  };
}

export function gstSplit(total) {
  const taxable = total / 1.18;
  const half = (total - taxable) / 2;
  return { taxable, cgst: half, sgst: half, total };
}

let seq = 100;
function nextId(prefix) {
  seq += 1;
  return `${prefix}${seq}`;
}

function roleOf(state) {
  return state.user?.role || "";
}

function releaseRoom(occupied, booking) {
  if (!booking?.roomHeld || !booking.roomId) return occupied;
  return { ...occupied, [booking.roomId]: Math.max(0, (occupied[booking.roomId] || 0) - 1) };
}

export function reducer(state, action) {
  const role = roleOf(state);
  if (action.type === "login") {
    const user = action.user;
    if (!user?.role) return state;
    return { ...state, user };
  }
  if (action.type === "logout") return { ...state, user: null };
  if (action.type === "add-booking") {
    if (!allow(role, "booking.create")) return state;
    const approval = role === "Receptionist" ? "manager" : "done";
    const booking = {
      ...action.booking,
      id: nextId("b"),
      no: `BK-2026-${String(20 + state.bookings.length).padStart(4, "0")}`,
      status: role === "Receptionist" ? "Pending" : (action.booking.status || "Pending"),
      approval,
      createdBy: state.user?.id || "",
      stay: "",
      roomHeld: false,
    };
    const occupied = { ...state.occupied };
    if (booking.roomId && occupied[booking.roomId] < (ROOM_TYPES.find((r) => r.id === booking.roomId)?.count || 0)) {
      occupied[booking.roomId] += 1;
      booking.roomHeld = true;
    }
    const guests = state.guests.some((g) => g.phone === booking.phone)
      ? state.guests.map((g) => (g.phone === booking.phone ? { ...g, bookings: g.bookings + 1 } : g))
      : [{ id: nextId("g"), name: booking.guest, phone: booking.phone, email: booking.email || "", address: booking.address || "", bookings: 1 }, ...state.guests];
    return { ...state, occupied, guests, bookings: [booking, ...state.bookings] };
  }
  if (action.type === "update-booking") {
    if (!allow(role, "booking.edit")) return state;
    return {
      ...state,
      bookings: state.bookings.map((b) => (b.id === action.booking.id ? { ...b, ...action.booking, approval: b.approval, createdBy: b.createdBy, stay: b.stay } : b)),
    };
  }
  if (action.type === "review-booking") {
    if (!allow(role, "booking.review")) return state;
    return {
      ...state,
      bookings: state.bookings.map((b) => (b.id === action.id && b.approval === "manager" ? { ...b, approval: "owner" } : b)),
    };
  }
  if (action.type === "confirm-booking") {
    if (role !== "Owner") return state;
    return {
      ...state,
      bookings: state.bookings.map((b) => (b.id === action.id ? { ...b, approval: "done", status: b.status === "Cancelled" ? b.status : "Confirmed" } : b)),
    };
  }
  if (action.type === "cancel-booking") {
    if (role !== "Owner") return state;
    const booking = state.bookings.find((b) => b.id === action.id);
    if (!booking) return state;
    return {
      ...state,
      occupied: releaseRoom(state.occupied, booking),
      bookings: state.bookings.map((b) => (b.id === action.id ? { ...b, status: "Cancelled", roomHeld: false } : b)),
    };
  }
  if (action.type === "delete-booking") {
    if (role !== "Owner") return state;
    const booking = state.bookings.find((b) => b.id === action.id);
    if (!booking) return state;
    return {
      ...state,
      occupied: releaseRoom(state.occupied, booking),
      bookings: state.bookings.filter((b) => b.id !== action.id),
    };
  }
  if (action.type === "check-in") {
    if (!allow(role, "dash.checkin")) return state;
    return { ...state, bookings: state.bookings.map((b) => (b.id === action.id && b.status !== "Cancelled" && b.stay !== "out" ? { ...b, stay: "in" } : b)) };
  }
  if (action.type === "check-out") {
    if (!allow(role, "dash.checkout")) return state;
    return { ...state, bookings: state.bookings.map((b) => (b.id === action.id && b.stay === "in" ? { ...b, stay: "out" } : b)) };
  }
  if (action.type === "add-payment") {
    if (!allow(role, "payment.receive")) return state;
    const booking = state.bookings.find((b) => b.id === action.bookingId);
    if (!booking) return state;
    const amount = Math.max(0, Number(action.amount) || 0);
    if (!amount) return state;
    const row = {
      id: nextId("p"),
      bookingNo: booking.no,
      guest: booking.guest,
      hall: booking.roomId ? (ROOM_TYPES.find((r) => r.id === booking.roomId)?.name || "Room") : hallName(booking.hallId),
      amount,
      mode: action.mode || "Cash",
      date: action.date || TODAY,
      kind: "collection",
      locked: true,
    };
    return {
      ...state,
      payments: [row, ...state.payments],
      bookings: state.bookings.map((b) => (b.id === booking.id ? { ...b, paid: b.paid + amount, status: b.status === "Pending" && b.approval === "done" ? "Confirmed" : b.status } : b)),
    };
  }
  if (action.type === "request-refund") {
    if (!allow(role, "refund.request")) return state;
    const booking = state.bookings.find((b) => b.id === action.bookingId);
    const amount = Math.max(0, Number(action.amount) || 0);
    if (!booking || !amount || amount > (booking.paid || 0)) return state;
    return {
      ...state,
      refunds: [{
        id: nextId("rf"),
        bookingId: booking.id,
        bookingNo: booking.no,
        guest: booking.guest,
        amount,
        mode: action.mode || "UPI",
        reason: action.reason || "",
        status: "requested",
        by: state.user?.name || "Receptionist",
      }, ...state.refunds],
    };
  }
  if (action.type === "verify-refund") {
    if (!allow(role, "refund.verify")) return state;
    return { ...state, refunds: state.refunds.map((r) => (r.id === action.id && r.status === "requested" ? { ...r, status: "verified" } : r)) };
  }
  if (action.type === "approve-refund") {
    if (role !== "Owner") return state;
    return { ...state, refunds: state.refunds.map((r) => (r.id === action.id && r.status === "verified" ? { ...r, status: "approved" } : r)) };
  }
  if (action.type === "process-refund") {
    if (role !== "Owner") return state;
    const request = state.refunds.find((r) => r.id === action.id && r.status === "approved");
    if (!request) return state;
    const booking = state.bookings.find((b) => b.id === request.bookingId);
    const row = {
      id: nextId("p"),
      bookingNo: request.bookingNo,
      guest: request.guest,
      hall: booking ? hallName(booking.hallId) : "",
      amount: request.amount,
      mode: request.mode,
      date: TODAY,
      kind: "refund",
      locked: true,
    };
    return {
      ...state,
      payments: [row, ...state.payments],
      refunds: state.refunds.map((r) => (r.id === request.id ? { ...r, status: "processed" } : r)),
      bookings: state.bookings.map((b) => (b.id === request.bookingId ? { ...b, paid: Math.max(0, (b.paid || 0) - request.amount) } : b)),
    };
  }
  if (action.type === "add-expense") {
    if (!allow(role, "expense.add") && !allow(role, "expense.submit")) return state;
    const status = role === "Owner" ? "approved" : "pending";
    return { ...state, expenses: [{ ...action.expense, id: nextId("e"), status, addedBy: state.user?.id || "", amount: Number(action.expense.amount) || 0 }, ...state.expenses] };
  }
  if (action.type === "update-expense") {
    if (role !== "Owner" && role !== "Manager") return state;
    return { ...state, expenses: state.expenses.map((e) => (e.id === action.expense.id ? { ...e, ...action.expense, status: e.status, addedBy: e.addedBy } : e)) };
  }
  if (action.type === "verify-expense") {
    if (!allow(role, "expense.verify")) return state;
    return {
      ...state,
      expenses: state.expenses.map((e) => (e.id === action.id && e.status === "pending" && e.addedBy !== state.user?.id ? { ...e, status: "verified" } : e)),
    };
  }
  if (action.type === "approve-expense") {
    if (role !== "Owner") return state;
    return { ...state, expenses: state.expenses.map((e) => (e.id === action.id && (e.status === "pending" || e.status === "verified") ? { ...e, status: "approved" } : e)) };
  }
  if (action.type === "reject-expense") {
    if (role !== "Owner") return state;
    return { ...state, expenses: state.expenses.map((e) => (e.id === action.id && e.status !== "approved" ? { ...e, status: "rejected" } : e)) };
  }
  if (action.type === "delete-expense") {
    if (role !== "Owner") return state;
    return { ...state, expenses: state.expenses.filter((e) => e.id !== action.id) };
  }
  if (action.type === "add-guest") {
    if (!allow(role, "guest.add")) return state;
    return { ...state, guests: [{ ...action.guest, id: nextId("g"), bookings: action.guest.bookings || 0 }, ...state.guests] };
  }
  if (action.type === "update-guest") {
    if (!allow(role, "guest.edit")) return state;
    return { ...state, guests: state.guests.map((g) => (g.id === action.guest.id ? { ...g, ...action.guest, id: g.id, bookings: g.bookings } : g)) };
  }
  if (action.type === "add-document") {
    return { ...state, documents: [{ ...action.document, id: nextId("d") }, ...state.documents] };
  }
  if (action.type === "add-user") {
    if (role !== "Owner") return state;
    const nextRole = action.user?.role;
    if (nextRole !== "Manager" && nextRole !== "Receptionist") return state;
    const phone = digits(action.user.phone);
    if (phone.length !== 10 || !action.user.name?.trim() || !action.user.password?.trim()) return state;
    if (state.staff.some((user) => user.phone === phone)) return state;
    return { ...state, staff: [...state.staff, { id: nextId("u"), name: action.user.name.trim(), phone, password: action.user.password, role: nextRole, active: true }] };
  }
  if (action.type === "toggle-user") {
    if (role !== "Owner") return state;
    const target = state.staff.find((user) => user.id === action.id);
    if (!target || target.role === "Owner") return state;
    return { ...state, staff: state.staff.map((user) => (user.id === action.id ? { ...user, active: !user.active } : user)) };
  }
  if (action.type === "update-settings") {
    if (role !== "Owner") return state;
    return { ...state, settings: { ...state.settings, ...action.settings } };
  }
  return state;
}
