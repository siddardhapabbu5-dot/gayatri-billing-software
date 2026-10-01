import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { api, clearAuth, getAuthUser, getToken, login } from "../api/client.js";
import ServerStatus from "../components/ServerStatus.jsx";
import ForgotPassword from "../components/ForgotPassword.jsx";
import { fetchDeskSnapshot, saveBookingExtras } from "../api/ops.js";
import { draftExtrasTotal, formFromCharges, GENERATORS, linesFromExtras, powerAmount } from "../extraCharges.js";
import { pushPhoneAction, savesToDesk, snapshotToPhone } from "./deskSync.js";
import { GuestCrm, LeadStatusPage, SourcePage } from "./CrmPages.jsx";
import { invoicePdfFile, shareInvoiceFile } from "./invoicePdf.js";
import {
  HALLS, ROOM_TYPES, TODAY, allow, balanceOf, gstSplit, hallName, inr, inSpan, initialState, kpis, money, phoneUserFromStaff, rangeFor, reducer, screenAllowed, showDate,
} from "./previewState.js";
import "./mobile-preview.css";

function tabsFor(role) {
  if (role === "Receptionist") {
    return [
      ["home", "⌂", "Home"],
      ["reservations", "▦", "Reservations"],
      ["guests", "👤", "Guests"],
      ["payments", "₹", "Payments"],
      ["more", "•••", "More"],
    ];
  }
  return [
    ["home", "⌂", "Home"],
    ["reservations", "▦", "Reservations"],
    ["reports", "▤", "Reports"],
    ["finance", "₹", "Finance"],
    ["more", "•••", "More"],
  ];
}

function moneyStanding(booking) {
  if (String(booking?.status || "").toLowerCase() === "cancelled") return { key: "cancelled", label: "Cancelled" };
  const paid = Number(booking?.paid) || 0;
  const due = balanceOf(booking || {});
  if (paid > 0 && due <= 0) return { key: "paid", label: "Paid" };
  if (paid > 0) return { key: "partial", label: "Partial" };
  return { key: "pending", label: "Pending" };
}

const PHONE_SCREEN_KEY = "gayatri-phone-screen";
const PHONE_GST_KEY = "gayatri-phone-gst";

function kolkataParts() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const pick = (type) => Number(parts.find((part) => part.type === type)?.value || 0);
  return { year: pick("year"), month: pick("month"), day: pick("day"), hour: pick("hour") };
}

function todayIso() {
  const now = kolkataParts();
  return `${now.year}-${String(now.month).padStart(2, "0")}-${String(now.day).padStart(2, "0")}`;
}

function greetingNow() {
  const hour = kolkataParts().hour;
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

function restoredPhoneUser() {
  if (!getToken()) return null;
  const saved = getAuthUser();
  if (!saved?.role && !saved?.email) return null;
  return phoneUserFromStaff(saved);
}

function restoredPhoneScreen() {
  try {
    const screen = sessionStorage.getItem(PHONE_SCREEN_KEY);
    if (screen && screen !== "login") return screen;
  } catch {
    /* private mode */
  }
  return "home";
}

function readGstMemory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PHONE_GST_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function packageBase(booking) {
  const hall = HALLS.find((item) => item.id === booking?.hallId);
  const room = ROOM_TYPES.find((item) => item.id === booking?.roomId);
  const packages = room ? [["Night", room.rate]] : [["Half Day", hall?.half || 0], ["Full Day", hall?.full || 0]];
  return packages.find((item) => item[0] === booking?.package)?.[1] || 0;
}

function phoneBill(booking) {
  const stored = Number(booking?.total) || 0;
  const mode = booking?.gstMode === "with" ? "with" : "without";
  if (mode === "without") return { amount: stored, gst: 0, total: stored, gstLabel: "Without GST" };
  const gst = Math.round((stored * 18) / 118);
  return { amount: Math.max(0, stored - gst), gst, total: stored, gstLabel: "GST 18%" };
}

function withRememberedGst(previousBookings, patch, hint) {
  const memory = readGstMemory();
  const previous = new Map();
  for (const booking of previousBookings || []) {
    if (booking.gstMode !== "with" && booking.gstMode !== "without") continue;
    if (booking.serverId) previous.set(`s:${booking.serverId}`, booking.gstMode);
    if (booking.no) previous.set(`n:${booking.no}`, booking.gstMode);
  }
  let bookings = (patch?.bookings || []).map((booking) => {
    if (booking.gstMode === "with" || booking.gstMode === "without") return booking;
    const gstMode = previous.get(`s:${booking.serverId}`) || previous.get(`n:${booking.no}`) || memory[booking.no] || "";
    return gstMode ? { ...booking, gstMode } : booking;
  });
  if (hint && (hint.gstMode === "with" || hint.gstMode === "without")) {
    const fresh = bookings.filter((booking) => !booking.gstMode && booking.guest === hint.guest && booking.date === hint.date);
    const target = fresh[fresh.length - 1];
    if (target) bookings = bookings.map((booking) => (booking === target ? { ...booking, gstMode: hint.gstMode } : booking));
  }
  const nextMemory = { ...memory };
  for (const booking of bookings) {
    if (booking.no && (booking.gstMode === "with" || booking.gstMode === "without")) nextMemory[booking.no] = booking.gstMode;
  }
  try {
    localStorage.setItem(PHONE_GST_KEY, JSON.stringify(nextMemory));
  } catch {
    /* private mode */
  }
  return { ...patch, bookings };
}

function monthCells(year, month) {
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: first }, () => null);
  for (let d = 1; d <= days; d += 1) cells.push(d);
  while (cells.length % 7) cells.push(null);
  return cells;
}

function download(name, text, type = "text/plain") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function slotWindow(slot) {
  const key = String(slot || "full-day").toLowerCase();
  if (key.includes("half")) return [9, 16];
  if (key.includes("9:00 am") || key.includes("9:00-am")) return [9, 12];
  if (key.includes("12")) return [12, 15];
  if (key.includes("3:00")) return [15, 18];
  if (key.includes("6:00")) return [18, 21];
  if (key.includes("9:00 pm") || key.includes("21")) return [21, 24];
  return [0, 24];
}

function slotsOverlap(a, b) {
  const [startA, endA] = slotWindow(a);
  const [startB, endB] = slotWindow(b);
  return startA < endB && startB < endA;
}

function downloadPdf(name, lines) {
  const commands = ["BT", "/F1 11 Tf", "48 800 Td"];
  lines.forEach((line, index) => {
    const safe = String(line).replace(/[()\\]/g, " ");
    if (index) commands.push("0 -16 Td");
    commands.push(`(${safe}) Tj`);
  });
  commands.push("ET");
  const stream = commands.join("\n");
  const objects = [
    "1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj",
    "2 0 obj<< /Type /Pages /Count 1 /Kids [3 0 R] >>endobj",
    "3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj",
    `4 0 obj<< /Length ${stream.length} >>stream\n${stream}\nendstream endobj`,
    "5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((object) => {
    offsets.push(pdf.length);
    pdf += `${object}\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  download(name, pdf, "application/pdf");
}

function shareWhatsApp(text, phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  const path = digits ? `https://wa.me/${digits}?text=` : "https://wa.me/?text=";
  window.open(`${path}${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
}

function payStanding(booking, refunds) {
  const openRefund = (refunds || []).some((refund) => refund.bookingNo === booking.no && !["processed", "rejected"].includes(refund.status));
  if (openRefund) return { key: "refund", label: "Refund Processing", short: "Refund" };
  if (String(booking.status || "").toLowerCase() === "cancelled") return { key: "cancelled", label: "Cancelled", short: "Cancelled" };
  const bill = phoneBill(booking);
  const paid = Number(booking.paid) || 0;
  const due = Math.max(0, bill.total - paid);
  if (paid > 0 && due <= 0) return { key: "paid", label: "Paid", short: "Paid" };
  if (paid > 0) return { key: "partial", label: "Partial Payment", short: "Partial" };
  return { key: "pending", label: "Payment Pending", short: "Pending" };
}

function PayNav({ role, current, onTab }) {
  const items = [
    ["payments", "Payments", "pay-history"],
    ["history", "Payment History", "pay-ledger"],
  ];
  if (role !== "Receptionist") items.push(["register", "Payment Register", "register"]);
  return (
    <div className="mapp-chips">
      {items.map(([id, label, screen]) => (
        <button key={id} type="button" className={current === id ? "is-on" : ""} onClick={() => onTab(screen)}>{label}</button>
      ))}
    </div>
  );
}

function Top({ title, onBack, onBell }) {
  return (
    <header className="mapp-top">
      {onBack ? <button type="button" className="mapp-icon" aria-label="Back" onClick={onBack}>←</button> : <span className="mapp-icon" />}
      <div className="mapp-brand">
        <img src="/site/images/logo-gold.png" alt="" />
        <span>GAYATRI</span>
        {title ? <strong style={{ letterSpacing: 0, fontWeight: 600 }}>{title}</strong> : null}
      </div>
      <button type="button" className="mapp-icon" aria-label="Alerts" onClick={onBell}>🔔</button>
    </header>
  );
}

export default function MobilePreviewApp() {
  const openingUser = restoredPhoneUser();
  const [state, dispatch] = useReducer(reducer, openingUser ? { ...initialState, user: openingUser } : initialState);
  const [stack, setStack] = useState(openingUser ? [restoredPhoneScreen()] : ["login"]);
  const [notice, setNotice] = useState("");
  const [alerts, setAlerts] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginNote, setLoginNote] = useState("");
  const [linkNote, setLinkNote] = useState("");
  const [lastSync, setLastSync] = useState("");
  const [selectedId, setSelectedId] = useState("b1");
  const [draft, setDraft] = useState(null);
  const [expenseId, setExpenseId] = useState(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const screen = stack[stack.length - 1];
  const role = state.user?.role || "";

  useEffect(() => {
    if (!state.user || screen === "login") return;
    try {
      sessionStorage.setItem(PHONE_SCREEN_KEY, screen);
    } catch {
      /* private mode */
    }
  }, [screen, state.user]);
  const figures = useMemo(() => kpis(state), [state]);
  const booking = state.bookings.find((b) => b.id === selectedId) || state.bookings[0];

  function commit(action) {
    if (!savesToDesk(action.type) || !getToken()) {
      dispatch(action);
      return;
    }
    pushPhoneAction(action, stateRef.current)
      .then(() => fetchDeskSnapshot())
      .then((snap) => commit({ type: "hydrate", patch: withRememberedGst(stateRef.current.bookings, snapshotToPhone(snap), action.booking) }))
      .catch((err) => setNotice(err.status ? (err.message || "The server did not save this.") : "The server did not answer. This screen keeps trying."));
  }

  useEffect(() => {
    if (!state.user || !getToken()) return undefined;
    let stop = false;
    async function pull() {
      try {
        const snap = await fetchDeskSnapshot();
        if (!stop) {
          commit({ type: "hydrate", patch: withRememberedGst(stateRef.current.bookings, snapshotToPhone(snap)) });
          setLinkNote("");
          setLastSync(new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" }));
        }
      } catch (err) {
        if (err?.status === 401 && err.auth) {
          clearAuth();
          try { sessionStorage.removeItem(PHONE_SCREEN_KEY); } catch { /* private mode */ }
          dispatch({ type: "logout" });
          setPassword("");
          setLoginNote(err.auth === "expired" ? "Session expired. Sign in again." : "Your password was changed. Sign in with the new password.");
          setStack(["login"]);
        } else if (!stop) {
          setLinkNote("Reconnecting to the server…");
        }
      }
    }
    pull();
    const timer = setInterval(pull, 3000);
    function onVisible() {
      if (document.visibilityState === "visible") pull();
    }
    window.addEventListener("focus", pull);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stop = true;
      clearInterval(timer);
      window.removeEventListener("focus", pull);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [state.user]);

  async function clearDesk() {
    const typed = window.prompt("Type CLEAR to remove every booking and payment. The staff desk uses the same records and updates on its own. Halls, rooms, expenses, and logins stay.");
    if (typed !== "CLEAR") return;
    const out = await api("/api/admin/ops/clear", { method: "POST", body: JSON.stringify({ confirm: "CLEAR" }) });
    const snap = await fetchDeskSnapshot();
    dispatch({ type: "hydrate", patch: snapshotToPhone(snap) });
    flash(`Cleared ${out.bookingsRemoved} bookings and ${out.paymentsRemoved} payments. The staff desk updates on its own.`);
  }

  function go(next) {
    if (state.user && !screenAllowed(state.user.role, next)) {
      setNotice("This page is not available for your login.");
      return;
    }
    setNotice("");
    setStack((s) => [...s, next]);
  }
  function openFinance(next) {
    if (state.user && !screenAllowed(state.user.role, next)) {
      setNotice("This page is not available for your login.");
      return;
    }
    setNotice("");
    const finance = new Set(["pay-history", "pay-ledger", "register"]);
    setStack((s) => {
      const trimmed = [...s];
      while (trimmed.length > 1 && finance.has(trimmed[trimmed.length - 1])) trimmed.pop();
      return [...trimmed, next];
    });
  }
  function openPay(id) {
    setSelectedId(id);
    go("pay-detail");
  }
  function back() {
    setNotice("");
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  }
  function tab(id) {
    setNotice("");
    const root = { home: "home", reservations: "reservations", reports: "reports", finance: "pay-history", payments: "pay-history", guests: "guests", more: "more" }[id];
    setStack([root]);
  }
  function flash(text) {
    setNotice(text);
  }
  function openBooking(id) {
    setSelectedId(id);
    setDraft(null);
    go("detail");
  }

  const tabOn = ["home"].includes(screen) ? "home"
    : ["reservations", "new", "calendar", "detail", "rooms", "room-avail"].includes(screen) ? "reservations"
      : ["guests"].includes(screen) && role === "Receptionist" ? "guests"
        : ["reports", "today", "period"].includes(screen) ? "reports"
          : ["pay", "pay-detail", "pay-history", "pay-ledger", "register", "invoice"].includes(screen) ? (role === "Receptionist" ? "payments" : "finance")
            : ["expense", "expense-list"].includes(screen) ? (role === "Receptionist" ? "more" : "finance")
              : "more";

  return (
    <div className="mapp">
      <div className="mapp-frame">
        <p className="mapp-banner">{linkNote || (state.linked ? "Synced with the server." : "Same login as the staff desk.")}</p>
        {screen === "login" ? (
          <Login
            email={email}
            setEmail={setEmail}
            password={password}
            setPassword={setPassword}
            note={loginNote}
            onLogin={async () => {
              if (!email.trim() || !password.trim()) {
                setLoginNote("Enter your email and password.");
                return;
              }
              setLoginNote("");
              try {
                const out = await login(email.trim(), password);
                const user = phoneUserFromStaff(out.user);
                dispatch({ type: "login", user });
                const snap = await fetchDeskSnapshot();
                dispatch({ type: "hydrate", patch: withRememberedGst([], snapshotToPhone(snap)) });
                setLastSync(new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" }));
                setLinkNote("");
                setPassword("");
                setStack(["home"]);
              } catch (err) {
                setLoginNote(err.reason || err.message || "Cannot connect to server");
              }
            }}
          />
        ) : (
          <>
            <Top title={screen === "home" ? "" : ""} onBack={stack.length > 1 ? back : null} onBell={() => setAlerts(true)} />
            <main className="mapp-body">
              {notice ? <p className="mapp-note">{notice}</p> : null}
              {state.user && !screenAllowed(role, screen) ? <p className="mapp-note">This page is not available for the {role} login.</p> : null}
              {screen === "home" && <Dashboard state={state} figures={figures} go={go} flash={flash} dispatch={commit} onPay={openPay} />}
              {screen === "reservations" && <ReservationList state={state} onOpen={openBooking} onNew={() => go("new")} dispatch={commit} flash={flash} />}
              {screen === "new" && (
                <NewReservation
                  state={state}
                  onHall={(hallId) => { setDraft({ hallId, roomId: "", date: todayIso(), slot: "9:00 AM", guests: 2, package: "Half Day", requirements: [], guest: "", phone: "", email: "", gst: "", gstMode: "with", address: "" }); go("calendar"); }}
                  onRoom={(roomId) => { setDraft({ hallId: "", roomId, date: todayIso(), slot: "Night", guests: 2, package: "Night", requirements: [], guest: "", phone: "", email: "", gst: "", gstMode: "with", address: "" }); go("calendar"); }}
                />
              )}
              {screen === "calendar" && draft && <Calendar state={state} draft={draft} setDraft={setDraft} onContinue={() => go("detail")} />}
              {screen === "calendar" && !draft && <DeskCalendar state={state} />}
              {screen === "detail" && (
                <BookingDetail
                  role={role}
                  booking={draft ? null : booking}
                  draft={draft}
                  setDraft={setDraft}
                  onSave={(next) => {
                    if (draft) {
                      commit({ type: "add-booking", booking: next });
                      setDraft(null);
                      flash(role === "Receptionist" ? "Booking sent to the manager for review." : "Booking added. The reservation list and dashboard now include it.");
                      setStack(["reservations"]);
                    } else {
                      commit({ type: "update-booking", booking: next });
                      flash("Booking updated on the list and the dashboard.");
                    }
                  }}
                  onPay={() => go("pay")}
                  onInvoice={() => go("invoice")}
                  onCancel={() => { commit({ type: "cancel-booking", id: booking.id }); flash("Booking cancelled."); }}
                  onDelete={() => { commit({ type: "delete-booking", id: booking.id }); flash("Booking deleted."); setStack(["reservations"]); }}
                  onReview={() => { commit({ type: "review-booking", id: booking.id }); flash("Sent to the owner. Owner confirmation is optional."); }}
                  onConfirm={() => { commit({ type: "confirm-booking", id: booking.id }); flash("Owner confirmed this booking."); }}
                  onCheckIn={() => { commit({ type: "check-in", id: booking.id }); flash("Guest checked in."); }}
                  onCheckOut={() => { commit({ type: "check-out", id: booking.id }); flash("Guest checked out."); }}
                />
              )}
              {screen === "rooms" && <RoomsBooking state={state} onContinue={() => go("room-avail")} />}
              {screen === "room-avail" && <RoomAvailability state={state} onOpen={(id) => { setSelectedId(id); setDraft(null); go("detail"); }} onPick={(roomId, date, roomNumber) => { setDraft({ hallId: "", roomId, roomNumber, date: date || todayIso(), slot: "Night", guests: 2, package: "Night", requirements: [], guest: "", phone: "", email: "", gst: "", gstMode: "with", address: "" }); go("detail"); }} />}
              {screen === "pay" && (
                <Payment
                  role={role}
                  booking={booking}
                  onGst={(gstMode) => {
                    commit({ type: "set-gst", id: booking.id, gstMode });
                    try {
                      const memory = JSON.parse(localStorage.getItem(PHONE_GST_KEY) || "{}");
                      if (booking.no) memory[booking.no] = gstMode;
                      localStorage.setItem(PHONE_GST_KEY, JSON.stringify(memory));
                    } catch {
                      /* private mode */
                    }
                  }}
                  onCollect={async ({ error, rows, done }) => {
                    if (error) {
                      flash(error);
                      return;
                    }
                    if (!rows.length) {
                      flash("Enter an advance or a final amount.");
                      return;
                    }
                    try {
                      for (const row of rows) {
                        const action = { type: "add-payment", bookingId: booking.id, ...row };
                        if (getToken()) await pushPhoneAction(action, stateRef.current);
                        dispatch(action);
                      }
                      if (getToken()) {
                        const snap = await fetchDeskSnapshot();
                        commit({ type: "hydrate", patch: withRememberedGst(stateRef.current.bookings, snapshotToPhone(snap), booking) });
                      }
                      done?.();
                      flash("Payment received. Saved payments cannot be edited.");
                    } catch (err) {
                      setNotice(err.status ? (err.message || "The server did not save this.") : "The server did not answer. This screen keeps trying.");
                    }
                  }}
                  onSaveCharges={async (lines) => {
                    if (!booking.serverId) {
                      flash("Save the booking on the staff desk before adding charges.");
                      return false;
                    }
                    await saveBookingExtras(booking.serverId, lines);
                    if (getToken()) {
                      const snap = await fetchDeskSnapshot();
                      commit({ type: "hydrate", patch: withRememberedGst(stateRef.current.bookings, snapshotToPhone(snap), booking) });
                    }
                    flash("Additional charges saved on this bill.");
                    return true;
                  }}
                  onBill={() => go("invoice")}
                  onCancel={back}
                  onNext={() => go(role === "Receptionist" ? "invoice" : "guests")}
                  onQueue={() => go("refunds")}
                />
              )}
              {screen === "guests" && <GuestCrm state={state} dispatch={commit} flash={flash} />}
              {screen === "documents" && <GuestCrm state={state} dispatch={commit} flash={flash} documentsMode booking={booking} />}
              {screen === "lead-status" && <LeadStatusPage state={state} />}
              {screen === "source" && <SourcePage state={state} />}
              {screen === "reports" && screenAllowed(role, screen) && <ReportSummary state={state} role={role} go={go} />}
              {screen === "today" && screenAllowed(role, screen) && <TodayReport state={state} role={role} figures={figures} />}
              {screen === "period" && screenAllowed(role, screen) && <PeriodReport state={state} role={role} />}
              {screen === "pay-history" && <PaymentBoard state={state} role={role} onTab={openFinance} onOpen={openPay} />}
              {screen === "pay-detail" && (
                <PaymentDetail
                  state={state}
                  booking={booking}
                  role={role}
                  onCollect={() => go("pay")}
                />
              )}
              {screen === "pay-ledger" && <PaymentLedger state={state} role={role} onTab={openFinance} onOpen={openPay} />}
              {screen === "register" && screenAllowed(role, screen) && <Register state={state} role={role} onTab={openFinance} onOpen={openPay} />}
              {screen === "expense" && (
                <ExpenseEntry
                  existing={state.expenses.find((e) => e.id === expenseId)}
                  onSave={(expense) => {
                    if (expense.id) commit({ type: "update-expense", expense });
                    else commit({ type: "add-expense", expense });
                    setExpenseId(null);
                    flash(role === "Owner" ? "Expense added to the books." : "Bill uploaded. It is added to the books only after the owner approves it.");
                    setStack(role === "Receptionist" ? ["more"] : ["expense-list"]);
                  }}
                />
              )}
              {screen === "expense-list" && screenAllowed(role, screen) && (
                <ExpenseList
                  state={state}
                  role={role}
                  userId={state.user?.id}
                  onAdd={() => { setExpenseId(null); go("expense"); }}
                  onEdit={(id) => { setExpenseId(id); go("expense"); }}
                  onVerify={(id) => { commit({ type: "verify-expense", id }); flash("Expense verified. The owner still has to approve it."); }}
                  onApprove={(id) => { commit({ type: "approve-expense", id }); flash("Expense approved and added to profit and loss."); }}
                  onReject={(id) => { commit({ type: "reject-expense", id }); flash("Expense rejected. It is not in the books."); }}
                />
              )}
              {screen === "invoice" && <Invoice booking={booking} role={role} payments={state.payments} />}
              {screen === "refunds" && <RefundQueue state={state} dispatch={commit} flash={flash} />}
              {screen === "staff" && role === "Owner" && <StaffAdmin state={state} dispatch={commit} flash={flash} />}
              {screen === "backup" && role === "Owner" && <BackupDesk flash={flash} />}
              {screen === "audit" && role === "Owner" && <AuditLog />}
              {screen === "status" && role === "Owner" && <ServerStatus compact lastSync={lastSync} />}
              {screen === "settings" && role === "Owner" && <Settings state={state} dispatch={commit} flash={flash} onClear={clearDesk} />}
              {screen === "more" && <More state={state} go={go} onCalendar={() => { setDraft(null); go("calendar"); }} onLogout={() => { clearAuth(); try { sessionStorage.removeItem(PHONE_SCREEN_KEY); } catch { /* private mode */ } commit({ type: "logout" }); setPassword(""); setStack(["login"]); }} />}
            </main>
            {screen === "reservations" && allow(role, "booking.create") ? <button type="button" className="mapp-fab" aria-label="New reservation" onClick={() => go("new")}>+</button> : null}
            <nav className="mapp-nav">
              {tabsFor(role).map(([id, icon, label]) => (
                <button key={id} type="button" className={tabOn === id ? "is-on" : ""} onClick={() => tab(id)}>
                  <span>{icon}</span>{label}
                </button>
              ))}
            </nav>
          </>
        )}
        {alerts ? (
          <div className="mapp-card" style={{ position: "absolute", left: 12, right: 12, top: 88, zIndex: 3 }}>
            <strong>Alerts</strong>
            {(state.notices || []).length ? state.notices.map((notice) => (
              <p key={notice.id} className="sub"><strong>{notice.title}</strong> · {notice.body}</p>
            )) : <p className="sub">No new alerts.</p>}
            <button type="button" className="mapp-cta" onClick={() => setAlerts(false)}>Close</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Login({ email, setEmail, password, setPassword, note, busy = false, onLogin }) {
  const [forgot, setForgot] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  return (
    <div className="mapp-login">
      <div className="mapp-brand">
        <img src="/site/images/logo-gold.png" alt="" />
        <span>GAYATRI</span>
        <small>Venues & Convention</small>
      </div>
      <div className="card">
        {forgot ? (
          <ForgotPassword variant="phone" onBack={() => setForgot(false)} />
        ) : (
          <>
            <h2 style={{ marginTop: 0 }}>Enter the desk</h2>
            <p className="sub">Sign in with the same staff account used on the computer</p>
            <label>Email
              <input type="email" value={email} autoComplete="username" onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label>Password
              <span className="mapp-pass">
                <input type={showPassword ? "text" : "password"} value={password} autoComplete="current-password" onChange={(e) => setPassword(e.target.value)} />
                <button type="button" className="mapp-eye" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((open) => !open)}>
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3.3 2.3 2 3.6l2.4 2.4A12 12 0 0 0 1.2 12S4.6 19 12 19a11 11 0 0 0 4.8-1.1l3.6 3.6 1.3-1.3L3.3 2.3ZM12 17c-5.2 0-8.2-4.6-9-5 .4-.2 1.4-1.2 2.8-2.3l2.1 2.1A3.5 3.5 0 0 0 12 15.5c.5 0 1-.1 1.4-.3l1.6 1.6A9 9 0 0 1 12 17Zm7.2-2.1-1.5-1.5c.7-.6 1.3-1.3 1.6-1.6-.8-.9-3.8-4.8-8.3-4.8-.7 0-1.3.1-1.9.2L7.6 5.7A11 11 0 0 1 12 5c7.4 0 10.8 7 10.8 7s-1.2 2.5-3.6 4.9ZM9.5 12a2.5 2.5 0 0 0 3.4 2.3l-2.7-2.7c-.2.1-.4.2-.7.4Z"/></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 5c7.4 0 10.8 7 10.8 7S19.4 19 12 19 1.2 12 1.2 12 4.6 5 12 5Zm0 2C7 7 4.2 10.8 3.2 12 4.2 13.2 7 17 12 17s7.8-3.8 8.8-5C19.8 10.8 17 7 12 7Zm0 2.2A2.8 2.8 0 1 1 9.2 12 2.8 2.8 0 0 1 12 9.2Z"/></svg>
                  )}
                </button>
              </span>
            </label>
            <button type="button" className="mapp-textbtn" onClick={() => setForgot(true)}>Forgot password</button>
            <button type="button" className="mapp-cta" onClick={onLogin} disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
            {note ? <p className="sub">{note}</p> : null}
          </>
        )}
      </div>
    </div>
  );
}

function Dashboard({ state, figures, go, dispatch, flash, onPay }) {
  const role = state.user?.role;
  const rawName = String(state.user?.name || "").trim();
  const homeName = /^owner$/i.test(rawName) ? "Admin" : rawName;
  const homeRole = role === "Owner" ? "Admin" : role;
  const todayBookings = state.bookings.filter((b) => b.date === todayIso() && b.status !== "Cancelled");
  const upcoming = state.bookings.filter((b) => b.date >= todayIso() && b.status === "Confirmed").slice(0, 3);
  const reviewCount = state.bookings.filter((b) => b.approval === "manager").length;
  const ownerCount = state.bookings.filter((b) => b.approval === "owner").length;
  return (
    <>
      <p className="mapp-hello">{greetingNow()}<strong>{homeName}</strong>{homeRole && homeRole !== homeName ? <span className="sub">{homeRole}</span> : null}</p>
      <div className="mapp-kpis">
        {allow(role, "dash.collection") ? <button type="button" className="mapp-kpi mint" onClick={() => go("today")}><span className="sub">Today's Collection</span><b>{inr(figures.collectionToday)}</b></button> : null}
        {allow(role, "dash.bookings") ? <button type="button" className="mapp-kpi blue" onClick={() => go("reservations")}><span className="sub">Today's Bookings</span><b>{figures.bookingsToday}</b></button> : null}
        {allow(role, "dash.pending") ? <button type="button" className="mapp-kpi rose" onClick={() => go("pay-history")}><span className="sub">Pending Payments</span><b>{inr(figures.pending)}</b></button> : null}
        {role === "Owner" ? <button type="button" className="mapp-kpi mint" onClick={() => go("reports")}><span className="sub">Monthly Revenue</span><b>{inr(figures.revenueMonth)}</b></button> : null}
        {role === "Owner" ? <button type="button" className="mapp-kpi peach" onClick={() => go("expense-list")}><span className="sub">Today's Expenses</span><b>{inr(figures.expensesToday)}</b></button> : null}
        {role === "Owner" ? <button type="button" className="mapp-kpi lilac" onClick={() => go("period")}><span className="sub">Net Profit</span><b>{inr(figures.profit)}</b></button> : null}
        {allow(role, "dash.rooms") ? <button type="button" className="mapp-kpi" onClick={() => go("rooms")}><span className="sub">Occupied Rooms</span><b>{figures.occupied}</b></button> : null}
        {allow(role, "dash.rooms") ? <button type="button" className="mapp-kpi" onClick={() => go("room-avail")}><span className="sub">Available Rooms</span><b>{figures.available}</b></button> : null}
        {role === "Receptionist" ? <article className="mapp-kpi"><span className="sub">Checked in</span><b>{todayBookings.filter((b) => b.stay === "in").length}</b></article> : null}
        {role === "Receptionist" ? <article className="mapp-kpi"><span className="sub">Checked out</span><b>{state.bookings.filter((b) => b.stay === "out").length}</b></article> : null}
      </div>
      <h2>Quick actions</h2>
      <div className="mapp-2">
        {allow(role, "booking.create") ? <button type="button" className="mapp-cta" onClick={() => go("new")}>New Booking</button> : null}
        {allow(role, "report.daily") || role === "Owner" ? <button type="button" className="mapp-ghost" onClick={() => go(role === "Receptionist" ? "today" : "reports")}>View Reports</button> : null}
        {allow(role, "report.today") && role === "Receptionist" ? <button type="button" className="mapp-ghost" onClick={() => go("today")}>Today's Collection</button> : null}
        {allow(role, "payment.receive") ? <button type="button" className="mapp-ghost" onClick={() => go("pay-history")}>Payments</button> : null}
        {allow(role, "expense.add") || allow(role, "expense.submit") ? <button type="button" className="mapp-ghost" onClick={() => go("expense")}>{role === "Receptionist" ? "Upload Bill" : "Add Expense"}</button> : null}
        {role === "Owner" ? <button type="button" className="mapp-ghost" onClick={() => go("staff")}>Staff</button> : null}
        {allow(role, "refund.verify") || role === "Owner" || allow(role, "refund.request") ? <button type="button" className="mapp-ghost" onClick={() => go("refunds")}>Refunds</button> : null}
      </div>
      {role === "Manager" && reviewCount ? <p className="mapp-note">{reviewCount} booking{reviewCount === 1 ? "" : "s"} waiting for manager review.</p> : null}
      {role === "Owner" && ownerCount ? <p className="mapp-note">{ownerCount} booking{ownerCount === 1 ? "" : "s"} waiting for optional owner confirmation.</p> : null}
      {role === "Receptionist" ? (
        <section className="mapp-card">
          <strong>Today's check-in</strong>
          {todayBookings.slice(0, 6).map((b) => (
            <div key={b.id} className="mapp-row" style={{ marginTop: 8 }}>
              <span className="sub">{b.guest} · {b.no}</span>
              <span className="mapp-actions">
                {b.stay !== "in" && b.stay !== "out" ? <button type="button" onClick={() => { commit({ type: "check-in", id: b.id }); flash(`${b.guest} checked in.`); }}>Check in</button> : null}
                {b.stay === "in" ? <button type="button" onClick={() => { commit({ type: "check-out", id: b.id }); flash(`${b.guest} checked out.`); }}>Check out</button> : null}
                {b.stay === "out" ? <span className="sub">Checked out</span> : null}
                {b.stay === "in" ? <span className="sub">In house</span> : null}
              </span>
            </div>
          ))}
        </section>
      ) : (
        <section className="mapp-card">
          <div className="mapp-row"><strong>Upcoming Events</strong><button type="button" className="mapp-ghost" style={{ width: "auto", margin: 0 }} onClick={() => go("pay-history")}>View all</button></div>
          {upcoming.map((b) => {
            const standing = payStanding(b, state.refunds);
            return (
              <button key={b.id} type="button" className="mapp-eventline" onClick={() => onPay(b.id)}>
                <span className="sub">{placeName(b)} · {b.guest} · {showDate(b.date)} · {b.guests} guests</span>
                <span className={`mapp-badge is-${standing.key}`}>{standing.short}</span>
              </button>
            );
          })}
        </section>
      )}
    </>
  );
}

function ReservationList({ state, onOpen, onNew, dispatch, flash }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const rows = state.bookings.filter((b) => {
    const blob = `${b.no} ${b.guest} ${b.phone} ${placeName(b)}`.toLowerCase();
    return (status === "All" || b.status === status) && blob.includes(query.trim().toLowerCase());
  });
  return (
    <>
      <h1>Reservations</h1>
      <input placeholder="Search by name, phone, or booking no." value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="mapp-chips">
        {["All", "Confirmed", "Pending", "Cancelled"].map((item) => (
          <button key={item} type="button" className={status === item ? "is-on" : ""} onClick={() => setStatus(item)}>{item}</button>
        ))}
      </div>
      {rows.map((b) => (
        <button key={b.id} type="button" className="mapp-res" onClick={() => onOpen(b.id)}>
          <span className="mapp-ico">⌂</span>
          <span className="mapp-grow">
            <strong>{placeName(b)}</strong>
            <span className="sub">{b.guest} · {b.no}</span>
            <span className="sub">{showDate(b.date)} · Advance {inr(b.paid)} · Balance {inr(balanceOf(b))}</span>
          </span>
          <span className="mapp-end">
            <strong>{inr(b.total)}</strong>
            <span className={`mapp-status is-${moneyStanding(b).key}`}>{moneyStanding(b).label}</span>
          </span>
        </button>
      ))}
      {state.user?.role === "Manager" ? state.bookings.filter((b) => b.approval === "manager").map((b) => (
        <button key={`review-${b.id}`} type="button" className="mapp-ghost" onClick={() => { commit({ type: "review-booking", id: b.id }); flash(`${b.no} reviewed. Owner confirmation is optional.`); }}>Review {b.no}</button>
      )) : null}
      {state.user?.role === "Owner" ? state.bookings.filter((b) => b.approval === "owner" || b.approval === "manager").map((b) => (
        <button key={`confirm-${b.id}`} type="button" className="mapp-ghost" onClick={() => { commit({ type: "confirm-booking", id: b.id }); flash(`${b.no} confirmed by owner.`); }}>Confirm {b.no}</button>
      )) : null}
      <button type="button" className="mapp-cta" onClick={onNew}>New Reservation</button>
    </>
  );
}

function placeName(booking) {
  const room = ROOM_TYPES.find((item) => item.id === booking?.roomId);
  if (room && !booking?.hallId) return room.name;
  if (booking?.hallId && room) return `${hallName(booking.hallId)} · ${room.name}`;
  if (booking?.hallId) return hallName(booking.hallId);
  return room?.name || "Rooms";
}

function roomTypeId(typeName) {
  const name = String(typeName || "").toLowerCase();
  if (name.includes("suite") || name.includes("family")) return "suite";
  if (name.includes("deluxe") || name.includes("delux")) return "deluxe";
  if (name.includes("standard")) return "standard";
  return "";
}

function roomStock(state, roomId) {
  const live = (state?.serverRooms || []).filter((room) => roomTypeId(room.typeName) === roomId).length;
  return live || ROOM_TYPES.find((item) => item.id === roomId)?.count || 1;
}

function roomBookedOn(state, roomId, date) {
  const held = (state?.bookings || []).filter((booking) => booking.date === date && booking.roomId === roomId && !booking.hallId && String(booking.status || "").toLowerCase() !== "cancelled").length;
  return held >= roomStock(state, roomId);
}

function NewReservation({ state, onHall, onRoom }) {
  const [space, setSpace] = useState("halls");
  const [hallId, setHallId] = useState("imperial");
  const [roomId, setRoomId] = useState("suite");
  const today = todayIso();
  const bookedToday = new Set(
    (state?.bookings || [])
      .filter((b) => b.date === today && b.hallId && String(b.status || "").toLowerCase() !== "cancelled")
      .map((b) => b.hallId),
  );
  return (
    <>
      <h1>New Reservation</h1>
      <div className="mapp-seg">
        <button type="button" className={space === "halls" ? "is-on" : ""} onClick={() => setSpace("halls")}>Function Halls</button>
        <button type="button" className={space === "rooms" ? "is-on" : ""} onClick={() => setSpace("rooms")}>Rooms</button>
      </div>
      {space === "halls" ? HALLS.map((h) => {
        const booked = bookedToday.has(h.id);
        return (
          <button key={h.id} type="button" className={`mapp-hall${hallId === h.id ? " is-on" : ""}`} onClick={() => setHallId(h.id)}>
            <img src={h.photo} alt="" />
            <span><strong>{h.name}</strong><span className="sub" style={{ display: "block" }}>{h.meta}</span><span className={booked ? "occ" : "free"}>{booked ? "Booked today" : "Free today"}</span></span>
          </button>
        );
      }) : ROOM_TYPES.map((r) => {
        const booked = roomBookedOn(state, r.id, today);
        return (
          <button key={r.id} type="button" className={`mapp-hall${roomId === r.id ? " is-on" : ""}`} onClick={() => setRoomId(r.id)}>
            <span className="mapp-ico">🛏️</span>
            <span><strong>{r.name}</strong><span className="sub" style={{ display: "block" }}>{roomStock(state, r.id)} rooms · {inr(r.rate)} / night</span><span className={booked ? "occ" : "free"}>{booked ? "Booked today" : "Free today"}</span></span>
          </button>
        );
      })}
      {space === "halls"
        ? <button type="button" className="mapp-cta" onClick={() => onHall(hallId)}>Proceed to Guest Details</button>
        : <button type="button" className="mapp-cta" onClick={() => onRoom(roomId)}>Proceed to Guest Details</button>}
    </>
  );
}

function bookingWhen(booking) {
  const slot = String(booking?.slot || booking?.package || "").toLowerCase();
  if (slot.includes("full")) return "Full day · 8:00 AM – 11:00 PM";
  if (slot.includes("half")) return `Half day${booking?.slot ? ` · ${booking.slot}` : ""}`;
  if (slot.includes("night")) return "Night";
  return booking?.slot || booking?.package || "Booked";
}

function hallShortName(booking) {
  if (booking?.hallId) {
    const name = hallName(booking.hallId);
    return name && name !== "Hall" ? name.split(" ")[0] : "Hall";
  }
  if (booking?.roomId) {
    const room = ROOM_TYPES.find((item) => item.id === booking.roomId);
    return room ? room.name.split(" ")[0] : "Room";
  }
  return "Booking";
}

function DeskCalendar({ state }) {
  const opened = todayIso();
  const [cursor, setCursor] = useState({ y: Number(opened.slice(0, 4)), m: Number(opened.slice(5, 7)) - 1 });
  const [selected, setSelected] = useState(opened);
  const cells = monthCells(cursor.y, cursor.m);
  const label = new Date(cursor.y, cursor.m, 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
  const active = state.bookings.filter((b) => b.date && String(b.status || "").toLowerCase() !== "cancelled");
  const dayIso = (d) => `${cursor.y}-${String(cursor.m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const onDay = active.filter((b) => b.date === selected);
  return (
    <>
      <h1>Calendar</h1>
      <p className="sub">Tap a date to see booking times.</p>
      <section className="mapp-card mapp-month">
        <div className="mapp-month-brand">
          <img src="/site/images/logo-gold.png" alt="" />
          <span>GAYATRI</span>
          <strong>{label}</strong>
        </div>
        <div className="mapp-row">
          <button type="button" className="mapp-ghost" style={{ width: "auto" }} onClick={() => setCursor((c) => ({ y: new Date(c.y, c.m - 1, 1).getFullYear(), m: new Date(c.y, c.m - 1, 1).getMonth() }))}>Previous</button>
          <button type="button" className="mapp-ghost" style={{ width: "auto" }} onClick={() => setCursor((c) => ({ y: new Date(c.y, c.m + 1, 1).getFullYear(), m: new Date(c.y, c.m + 1, 1).getMonth() }))}>Next</button>
        </div>
        <div className="mapp-month-grid mapp-month-head">{"SUN MON TUE WED THU FRI SAT".split(" ").map((d) => <span key={d}>{d}</span>)}</div>
        <div className="mapp-month-grid">
          {cells.map((d, i) => {
            if (!d) return <span key={`e-${i}`} />;
            const iso = dayIso(d);
            const rows = active.filter((b) => b.date === iso);
            return (
              <button key={iso} type="button" className={`${iso === selected ? "is-on" : ""} ${rows.length ? "is-booked" : "is-free"} ${iso === opened ? "is-today" : ""}`} onClick={() => setSelected(iso)}>
                <b>{d}</b>
                {rows.map((b) => <em key={b.id}>{hallShortName(b)}</em>)}
              </button>
            );
          })}
        </div>
      </section>
      <section className="mapp-caltip">
        {onDay.length ? onDay.map((b) => (
          <p key={b.id}>
            <strong>{b.guest}</strong>
            {placeName(b)} · {bookingWhen(b)} · {b.no}
          </p>
        )) : <p>Nothing booked on this date.</p>}
      </section>
    </>
  );
}

function Calendar({ state, draft, setDraft, onContinue }) {
  const opened = draft?.date && /^\d{4}-\d{2}-\d{2}$/.test(draft.date) ? draft.date : todayIso();
  const [cursor, setCursor] = useState({ y: Number(opened.slice(0, 4)), m: Number(opened.slice(5, 7)) - 1 });
  if (!draft) return <p className="sub">Choose a hall from New Reservation first.</p>;
  const cells = monthCells(cursor.y, cursor.m);
  const label = new Date(cursor.y, cursor.m, 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
  const active = state.bookings.filter((b) => b.date && String(b.status || "").toLowerCase() !== "cancelled");
  const roomStay = Boolean(draft?.roomId) && !draft?.hallId;
  const sameHall = roomStay
    ? active.filter((b) => b.roomId === draft.roomId && !b.hallId)
    : active.filter((b) => b.hallId && b.hallId === draft?.hallId);
  const selected = /^\d{4}-\d{2}-\d{2}$/.test(draft?.date || "") ? draft.date : todayIso();
  const day = Number(selected.slice(8));
  const onDay = sameHall.filter((b) => b.date === selected);
  const slots = roomStay ? ["Night"] : ["9:00 AM", "12:00 PM", "3:00 PM", "6:00 PM", "9:00 PM"];
  const held = (slot) => (roomStay
    ? roomBookedOn(state, draft.roomId, draft.date)
    : sameHall.some((b) => b.date === draft.date && slotsOverlap(slot, b.slot || b.package || "full-day")));
  const dayIso = (d) => `${cursor.y}-${String(cursor.m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const room = ROOM_TYPES.find((item) => item.id === draft?.roomId);
  return (
    <>
      <h1>Availability</h1>
      <p className="sub">{roomStay ? `${room?.name || "Room"} · ${inr(room?.rate || 0)} / night` : (draft?.hallId ? hallName(draft.hallId) : "Rooms")}</p>
      <section className="mapp-card">
        <div className="mapp-row">
          <button type="button" className="mapp-ghost" style={{ width: "auto" }} onClick={() => setCursor((c) => ({ y: new Date(c.y, c.m - 1, 1).getFullYear(), m: new Date(c.y, c.m - 1, 1).getMonth() }))}>‹</button>
          <strong>{label}</strong>
          <button type="button" className="mapp-ghost" style={{ width: "auto" }} onClick={() => setCursor((c) => ({ y: new Date(c.y, c.m + 1, 1).getFullYear(), m: new Date(c.y, c.m + 1, 1).getMonth() }))}>›</button>
        </div>
        <div className="mapp-cal">{"SUN MON TUE WED THU FRI SAT".split(" ").map((d) => <span key={d}>{d}</span>)}</div>
        <div className="mapp-days">
          {cells.map((d, i) => {
            const iso = d ? dayIso(d) : "";
            const booked = d && (roomStay ? roomBookedOn(state, draft.roomId, iso) : sameHall.some((b) => b.date === iso));
            const on = d === day && cursor.y === Number(selected.slice(0, 4)) && cursor.m + 1 === Number(selected.slice(5, 7));
            const isToday = iso === todayIso();
            return (
              <button key={`${d}-${i}`} type="button" disabled={!d} className={`${on ? "is-on" : ""} ${booked ? "is-booked" : ""} ${isToday ? "is-today" : ""}`} onClick={() => d && setDraft({ ...draft, date: iso })}>{d || ""}</button>
            );
          })}
        </div>
        <div className="mapp-legend"><span><i className="is-free" /> Available</span><span><i className="is-booked" /> Booked</span><span><i className="is-selected" /> Selected</span><span><i className="is-today" /> Today</span></div>
      </section>
      <h2>Bookings</h2>
      {onDay.length ? onDay.map((b) => {
        const standing = payStanding(b, state.refunds);
        const room = ROOM_TYPES.find((item) => item.id === b.roomId);
        const place = b.hallId ? hallName(b.hallId) : (room?.name || "Rooms");
        return (
          <article key={b.id} className="mapp-eventline">
            <span className="sub">{place} · {b.guest} · {showDate(b.date)} · {b.guests} guests</span>
            <span className={`mapp-badge is-${standing.key}`}>{standing.short}</span>
          </article>
        );
      }) : <p className="sub">No bookings on this date.</p>}
      <h2>Available Time Slots</h2>
      <div className="mapp-slots">
        {slots.map((slot) => <button key={slot} type="button" disabled={held(slot)} className={`mapp-slot${draft?.slot === slot ? " is-on" : ""}`} onClick={() => setDraft({ ...draft, slot })}>{held(slot) ? `${slot} booked` : slot}</button>)}
      </div>
      <button type="button" className="mapp-cta" onClick={onContinue}>Continue</button>
    </>
  );
}

function BookingDetail({ role, booking, draft, setDraft, onSave, onPay, onInvoice, onCancel, onDelete, onReview, onConfirm, onCheckIn, onCheckOut }) {
  const source = draft || booking;
  const [form, setForm] = useState(source);
  const canEdit = Boolean(draft) || allow(role, "booking.edit");
  const hall = HALLS.find((h) => h.id === form.hallId);
  const room = ROOM_TYPES.find((r) => r.id === form.roomId);
  const packages = room ? [["Night", room.rate]] : [["Half Day", hall?.half || form.total || 0], ["Full Day", hall?.full || form.total || 0]];
  const packageAmount = packages.find((item) => item[0] === form.package)?.[1] || Number(form.total) || packages[0][1];
  const gstChosen = form.gstMode === "with" || form.gstMode === "without";
  const gstMode = gstChosen ? form.gstMode : "";
  const gstAmount = gstMode === "with" ? Math.round(packageAmount * 0.18) : 0;
  const total = gstMode === "with" ? packageAmount + gstAmount : gstMode === "without" ? packageAmount : (Number(form.total) || packageAmount);
  function patch(partial) {
    const next = { ...form, ...partial };
    setForm(next);
    if (draft) setDraft(next);
  }
  return (
    <>
      <h1>Booking Details</h1>
      <article className="mapp-hall">
        {hall ? <img src={hall.photo} alt="" /> : <span className="mapp-ico">🛏️</span>}
        <span><strong>{hall?.name || room?.name}</strong><span className="sub" style={{ display: "block" }}>{hall?.meta || [room?.name, form.roomNumber || (form.roomNumbers || [])[0]].filter(Boolean).join(" · ")}</span>{booking ? <span className={`mapp-status is-${moneyStanding(booking).key}`}>{moneyStanding(booking).label}</span> : <span className="free">{form.status || "Free"}</span>}</span>
      </article>
      <label>Guest name<input value={form.guest || ""} readOnly={!canEdit} onChange={(e) => patch({ guest: e.target.value })} /></label>
      <label>Phone<input value={form.phone || ""} readOnly={!canEdit} onChange={(e) => patch({ phone: e.target.value })} /></label>
      <label>GST<input value={form.gst || ""} readOnly={!canEdit} onChange={(e) => patch({ gst: e.target.value })} /></label>
      <label>Address<input value={form.address || ""} readOnly={!canEdit} onChange={(e) => patch({ address: e.target.value })} /></label>
      <label>Guests<input value={form.guests || ""} readOnly={!canEdit} onChange={(e) => patch({ guests: e.target.value })} /></label>
      <label>Date<input type="date" value={/^\d{4}-\d{2}-\d{2}$/.test(form.date || "") ? form.date : todayIso()} disabled={!canEdit} onChange={(e) => e.target.value && patch({ date: e.target.value })} /></label>
      <p className="sub">Time · {form.slot || "9:00 AM"}</p>
      <div className="mapp-chips">
        {packages.map(([label, amount]) => (
          <button key={label} type="button" className={form.package === label ? "is-on" : ""} disabled={!canEdit} onClick={() => patch({ package: label })}>{label} {inr(amount)}</button>
        ))}
      </div>
      <div className="mapp-chips">
        <button type="button" className={gstMode === "with" ? "is-on" : ""} disabled={!canEdit} onClick={() => patch({ gstMode: "with" })}>With GST</button>
        <button type="button" className={gstMode === "without" ? "is-on" : ""} disabled={!canEdit} onClick={() => patch({ gstMode: "without" })}>Without GST</button>
      </div>
      <div className="mapp-chips">
        {["Decoration", "Catering", "Audio System"].map((item) => {
          const on = (form.requirements || []).includes(item);
          return <button key={item} type="button" className={on ? "is-on" : ""} disabled={!canEdit} onClick={() => patch({ requirements: on ? form.requirements.filter((x) => x !== item) : [...(form.requirements || []), item] })}>{item}</button>;
        })}
      </div>
      <div className="mapp-bill"><span>Amount</span><span>{inr(packageAmount)}</span></div>
      {gstMode ? <div className="mapp-bill"><span>{gstMode === "without" ? "Without GST" : "GST 18%"}</span><span>{inr(gstAmount)}</span></div> : null}
      <div className="mapp-bill"><span>Total Amount</span><strong>{inr(total)}</strong></div>
      {!draft ? <div className="mapp-bill"><span>Advance / paid</span><span>{inr(form.paid)}</span></div> : null}
      {!draft ? <div className="mapp-bill"><span>Balance</span><span>{inr(balanceOf(form))}</span></div> : null}
      {canEdit ? <button type="button" className="mapp-cta" onClick={() => onSave({ ...form, gstMode: gstMode || form.gstMode, total, paid: form.paid || 0, status: form.status || "Pending", guest: form.guest || "Guest", phone: form.phone || "" })}>{draft ? "Save booking" : "Save changes"}</button> : null}
      {!draft && allow(role, "payment.receive") ? <button type="button" className="mapp-ghost" onClick={onPay}>Proceed to Payment</button> : null}
      {!draft && (allow(role, "invoice.print") || allow(role, "invoice.generate")) ? <button type="button" className="mapp-ghost" onClick={onInvoice}>{role === "Receptionist" ? "Print invoice" : "Invoice, PDF, WhatsApp"}</button> : null}
      {!draft && role === "Manager" && form.approval === "manager" ? <button type="button" className="mapp-ghost" onClick={onReview}>Manager review</button> : null}
      {!draft && role === "Owner" && (form.approval === "owner" || form.approval === "manager") ? <button type="button" className="mapp-ghost" onClick={onConfirm}>Owner confirm</button> : null}
      {!draft && role === "Receptionist" && form.date === todayIso() && form.status !== "Cancelled" && form.stay !== "in" && form.stay !== "out" ? <button type="button" className="mapp-ghost" onClick={onCheckIn}>Check in</button> : null}
      {!draft && role === "Receptionist" && form.stay === "in" ? <button type="button" className="mapp-ghost" onClick={onCheckOut}>Check out</button> : null}
      {!draft && role === "Owner" && form.status !== "Cancelled" ? <button type="button" className="mapp-ghost" onClick={onCancel}>Cancel booking</button> : null}
      {!draft && role === "Owner" ? <button type="button" className="mapp-ghost" onClick={onDelete}>Delete booking</button> : null}
    </>
  );
}

function roomsForDate(state, iso) {
  return ROOM_TYPES.map((type) => {
    const rows = (state.serverRooms || [])
      .filter((room) => roomTypeId(room.typeName) === type.id)
      .slice()
      .sort((a, b) => String(a.number).localeCompare(String(b.number), undefined, { numeric: true }))
      .map((room) => ({
        room,
        booking: (state.bookings || []).find((booking) =>
          String(booking.status || "").toLowerCase() !== "cancelled"
          && booking.date === iso
          && (booking.roomNumbers || []).some((number) => String(number) === String(room.number))
        ) || null,
      }));
    return { type, rows, free: rows.filter((row) => !row.booking).length };
  });
}

function RoomsBooking({ state, onContinue }) {
  const groups = roomsForDate(state, todayIso());
  return (
    <>
      <h1>Rooms Booking</h1>
      {groups.map(({ type, rows, free }) => (
        <article key={type.id} className="mapp-line">
          <span className="mapp-ico">🛏️</span>
          <span className="mapp-grow"><strong>{type.name}</strong><span className="sub">{rows.length} rooms · {rows.length - free} occupied today</span><span className={free ? "free" : "occ"}>{free ? `${free} free` : "Occupied"}</span></span>
        </article>
      ))}
      <p className="mapp-note">Open availability to see which room number is free or occupied.</p>
      <button type="button" className="mapp-cta" onClick={onContinue}>Continue</button>
    </>
  );
}

const ROOM_AVAIL = {
  suite: { tab: "Suite Rooms", title: "Suite Room AC", card: "Suite Room", bed: "King Bed", guests: 2, photo: "/site/images/rooms/suite-ac.jpg", icon: "crown" },
  deluxe: { tab: "Deluxe AC", title: "Deluxe AC", card: "Deluxe Room", bed: "Queen Bed", guests: 2, photo: "/site/images/rooms/deluxe-ac.jpg", icon: "bed" },
  standard: { tab: "Standard AC", title: "Standard AC", card: "Standard Room", bed: "Twin Bed", guests: 2, photo: "/site/images/rooms/standard-ac.jpg", icon: "bed" },
};

function roomAvailState(room, booking) {
  if (booking) return { label: "Booked", tone: "booked" };
  const status = String(room?.status || "").toLowerCase();
  if (status.includes("maint")) return { label: "Maintenance", tone: "block" };
  if (status.includes("out")) return { label: "Out of order", tone: "block" };
  if (status.includes("occup")) return { label: "Occupied", tone: "booked" };
  return { label: "Available", tone: "free" };
}

function RoomGlyph({ kind }) {
  const common = { viewBox: "0 0 24 24", "aria-hidden": "true" };
  if (kind === "crown") return <svg {...common}><path fill="currentColor" d="M4 17h16v2H4v-2zm.6-2.2 2.8-6.4 3.1 3.6L12 5l1.5 7 3.1-3.6 2.8 6.4H4.6z" /></svg>;
  if (kind === "users") return <svg {...common}><path fill="currentColor" d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7.5.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM3 19.2C3 16.8 5.5 15 9 15s6 1.8 6 4.2V20H3v-.8zm12 .3c.1-1.8 1.6-3.2 4-3.5 1.5 0 2.6.5 3.2 1.3.3.4.2 1-.3 1H15v1.2z" /></svg>;
  if (kind === "check") return <svg {...common}><path fill="currentColor" d="M12 2a10 10 0 1 0 .01 20.01A10 10 0 0 0 12 2zm-1.1 13.6-3.2-3.2 1.4-1.4 1.8 1.8 4-4 1.4 1.4-5.4 5.4z" /></svg>;
  if (kind === "chev") return <svg {...common}><path d="M9 6.5 14.5 12 9 17.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  return <svg {...common}><path fill="currentColor" d="M4 18.5V14a2 2 0 0 1 2-2h5V8H8V6h5a2 2 0 0 1 2 2v4h1a2 2 0 0 1 2 2v4.5h2V20H2v-1.5h2zm2 0h5V14H6v4.5zm7 0h5V14h-5v4.5z" /></svg>;
}

function RoomAvailability({ state, onPick, onOpen }) {
  const [tab, setTab] = useState("all");
  const [day, setDay] = useState(0);
  const [closed, setClosed] = useState({});
  const dates = Array.from({ length: 6 }, (_, i) => {
    const start = todayIso().split("-").map(Number);
    const date = new Date(start[0], start[1] - 1, start[2] + i);
    return {
      iso: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
      label: date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
    };
  });
  const selected = dates[day].iso;
  const groups = roomsForDate(state, selected).filter(({ type }) => tab === "all" || type.id === tab);
  return (
    <>
      <h1>Room Availability</h1>
      <div className="mapp-dates">{dates.map((d, i) => <button key={d.iso} type="button" className={day === i ? "is-on" : ""} onClick={() => setDay(i)}>{d.label}</button>)}</div>
      <div className="mapp-room-tabs">
        <button type="button" className={tab === "all" ? "is-on" : ""} onClick={() => setTab("all")}>All</button>
        {ROOM_TYPES.map((type) => (
          <button key={type.id} type="button" className={tab === type.id ? "is-on" : ""} onClick={() => setTab(type.id)}>{ROOM_AVAIL[type.id].tab}</button>
        ))}
      </div>
      {groups.map(({ type, rows }) => {
        const meta = ROOM_AVAIL[type.id];
        const open = !closed[type.id];
        const ready = rows.filter((row) => roomAvailState(row.room, row.booking).tone === "free").length;
        return (
          <section key={type.id} className="mapp-room-group">
            <button type="button" className="mapp-room-head" onClick={() => setClosed((current) => ({ ...current, [type.id]: !current[type.id] }))}>
              <span className="mapp-room-glyph"><RoomGlyph kind={meta.icon} /></span>
              <strong>{meta.title}</strong>
              <span className={ready ? "free" : "occ"}>{ready} free of {rows.length}</span>
              <span className={open ? "mapp-room-chev is-up" : "mapp-room-chev"}><RoomGlyph kind="chev" /></span>
            </button>
            {open ? rows.map(({ room, booking }) => {
              const standing = roomAvailState(room, booking);
              const rate = Number(room.baseRate) || type.rate;
              return (
                <button key={room.number} type="button" className="mapp-room-card" onClick={() => (booking ? onOpen?.(booking.id) : onPick(type.id, selected, room.number))}>
                  <img src={meta.photo} alt="" />
                  <span className="mapp-grow">
                    <strong>{meta.card} {room.number}</strong>
                    <span className="mapp-room-rate"><b>{inr(rate)}</b> / night</span>
                    <span className="mapp-room-meta"><RoomGlyph kind="bed" />{meta.bed}<RoomGlyph kind="users" />{meta.guests} Guests</span>
                  </span>
                  <span className={`mapp-avail is-${standing.tone}`}>{standing.tone === "free" ? <RoomGlyph kind="check" /> : null}{standing.label}</span>
                  <span className="mapp-room-chev"><RoomGlyph kind="chev" /></span>
                </button>
              );
            }) : null}
          </section>
        );
      })}
    </>
  );
}

const PAY_MODES = ["Cash", "UPI", "Card", "Bank transfer"];

function payMethod(mode) {
  return mode === "Bank transfer" ? "Bank" : (mode || "Cash");
}

function dashDate(iso) {
  const [year, month, day] = String(iso || "").split("-");
  return year && month && day ? `${day}-${month}-${year}` : "—";
}

function Payment({ role, booking, onCollect, onGst, onSaveCharges, onBill }) {
  const gstMode = booking?.gstMode === "with" ? "with" : "without";
  const [discount, setDiscount] = useState("0");
  const [advance, setAdvance] = useState("0");
  const [advanceDate, setAdvanceDate] = useState(todayIso);
  const [advanceMode, setAdvanceMode] = useState("UPI");
  const [advanceRef, setAdvanceRef] = useState("");
  const [finalAmount, setFinalAmount] = useState("0");
  const [finalDate, setFinalDate] = useState(todayIso);
  const [finalMode, setFinalMode] = useState("UPI");
  const [finalRef, setFinalRef] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [extrasOpen, setExtrasOpen] = useState(true);
  const [extras, setExtras] = useState(() => formFromCharges(booking?.charges));
  const [savingCharges, setSavingCharges] = useState(false);
  const bill = phoneBill(booking);
  const off = Math.min(bill.total, Math.max(0, Number(discount) || 0));
  const gst = bill.gst;
  const total = Math.max(0, bill.total - off);
  const paid = Number(booking?.paid) || 0;
  const due = Math.max(0, total - paid);
  const savedExtras = (booking?.charges || []).reduce((sum, line) => sum + (Number(line.amount) || 0), 0);
  const bookingAmount = Math.max(0, total - savedExtras);
  const additional = draftExtrasTotal(extras);
  const grand = bookingAmount + additional;
  const policyAdvance = Math.round(total * 0.3);
  const remaining = Math.max(0, grand - paid - (Number(advance) || 0));
  const roomOnly = booking?.roomId && !booking?.hallId;
  const terms = roomOnly
    ? "I have read and agree to the Room Booking Terms & Conditions."
    : "I have read and agree to the Convention Terms & Conditions.";
  const power = powerAmount(extras.units, extras.rate);

  const savedKey = (booking?.charges || []).map((line) => `${line.category}:${line.amount}`).join("|");
  useEffect(() => {
    setExtras(formFromCharges(booking?.charges));
  }, [booking?.serverId, savedKey]);

  function setExtra(key, value) {
    setExtras((current) => ({ ...current, [key]: value }));
  }

  function save() {
    if (!agreed) {
      onCollect({ error: "Please agree to the terms.", rows: [] });
      return;
    }
    const rows = [];
    const adv = Math.max(0, Number(advance) || 0);
    const fin = Math.max(0, Number(finalAmount) || 0);
    if (adv > 0) rows.push({ amount: adv, mode: payMethod(advanceMode), date: advanceDate, payType: "Advance", ref: advanceRef });
    if (fin > 0) rows.push({ amount: fin, mode: payMethod(finalMode), date: finalDate, payType: "Final", ref: finalRef });
    onCollect({
      rows,
      done: () => {
        setAdvance("0");
        setFinalAmount("0");
        setAdvanceRef("");
        setFinalRef("");
      },
    });
  }

  async function saveCharges() {
    setSavingCharges(true);
    try {
      return await onSaveCharges(linesFromExtras(extras));
    } catch (err) {
      onCollect({ error: err.message || "Charges were not saved.", rows: [] });
      return false;
    } finally {
      setSavingCharges(false);
    }
  }

  return (
    <>
      <h1>Payment & Invoice</h1>
      <section className="mapp-card mapp-payhead">
        <div className="mapp-row"><span>Booking No.</span><span className="mapp-badge is-paid">{booking?.status || "Confirmed"}</span></div>
        <strong>{booking?.no || "—"}</strong>
      </section>
      <section className="mapp-card">
        <div className="mapp-row"><span className="mapp-ico">👤</span><strong>Customer Details</strong></div>
        <p className="sub">{booking?.guest || "Guest"}</p>
        <p className="sub">{booking?.phone || "—"}{booking?.email ? ` · ${booking.email}` : ""}</p>
      </section>
      <section className="mapp-card">
        <div className="mapp-row"><span>Hall / Venue</span><strong>{placeName(booking)}</strong></div>
        <div className="mapp-row"><span>Event Date</span><strong>{dashDate(booking?.date)}</strong></div>
        <div className="mapp-row"><span>Guest Count</span><strong>{booking?.guests || 0} Guests</strong></div>
      </section>
      <section className="mapp-card">
        <strong>Advance / paid</strong>
        <div className="mapp-bill"><span>Advance Amount</span><span>{inr(paid)}</span></div>
        <div className="mapp-bill"><span>Balance</span><span>{inr(due)}</span></div>
      </section>
      <div className="mapp-2">
        <label>Discount<input inputMode="numeric" value={discount} onChange={(e) => setDiscount(e.target.value)} onBlur={() => { if (discount === "") setDiscount("0"); }} /></label>
        <label>GST
          <select value={gstMode} onChange={(e) => onGst(e.target.value)}>
            <option value="with">With GST (18%)</option>
            <option value="without">Without GST</option>
          </select>
        </label>
      </div>
      <p className="mapp-policy">Policy advance 30% is {inr(policyAdvance)}. {gstMode === "without" ? "Without GST" : `GST ${inr(gst)}`} is part of the stored bill.</p>
      <h2>Advance payment</h2>
      <div className="mapp-2">
        <label>Advance amount<input inputMode="numeric" value={advance} onChange={(e) => setAdvance(e.target.value)} /></label>
        <label>Advance date<input type="date" value={advanceDate} onChange={(e) => setAdvanceDate(e.target.value)} /></label>
      </div>
      <div className="mapp-2">
        <label>Advance mode
          <select value={advanceMode} onChange={(e) => setAdvanceMode(e.target.value)}>{PAY_MODES.map((mode) => <option key={mode}>{mode}</option>)}</select>
        </label>
        <label>Advance ref / note<input value={advanceRef} placeholder="UPI ref / receipt no." onChange={(e) => setAdvanceRef(e.target.value)} /></label>
      </div>
      <h2>Final payment</h2>
      <p className="mapp-policy">Optional at booking. After confirm, the party is tracked by booking no. ({booking?.no || "BK-…"}) — same number for advance, final payment and report close. Remaining after advance: {inr(remaining)}.</p>
      <div className="mapp-2">
        <label>Final amount<input inputMode="numeric" value={finalAmount} onChange={(e) => setFinalAmount(e.target.value)} /></label>
        <label>Final payment date<input type="date" value={finalDate} onChange={(e) => setFinalDate(e.target.value)} /></label>
      </div>
      <div className="mapp-2">
        <label>Final mode
          <select value={finalMode} onChange={(e) => setFinalMode(e.target.value)}>{PAY_MODES.map((mode) => <option key={mode}>{mode}</option>)}</select>
        </label>
        <label>Final ref / note<input value={finalRef} placeholder="UPI ref / receipt no." onChange={(e) => setFinalRef(e.target.value)} /></label>
      </div>
      <section className="mapp-card">
        <button type="button" className="mapp-row mapp-fold" onClick={() => setExtrasOpen((open) => !open)}>
          <strong>Additional Charges</strong><span>{extrasOpen ? "▴" : "▾"}</span>
        </button>
        {extrasOpen ? (
          <>
            <label>Generator
              <select value={extras.generator} onChange={(e) => setExtra("generator", e.target.value)}>
                <option value="">Select KVA</option>
                {GENERATORS.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <h2>Power Bill</h2>
            <div className="mapp-2">
              <label>Units Consumed<input inputMode="numeric" value={extras.units} onChange={(e) => setExtra("units", e.target.value)} /></label>
              <label>Rate Per Unit<input inputMode="decimal" value={extras.rate} onChange={(e) => setExtra("rate", e.target.value)} /></label>
            </div>
            <div className="mapp-bill"><span>Power Amount</span><strong>{inr(power)}</strong></div>
            <label>Security Charges<input inputMode="numeric" value={extras.security} placeholder="0" onChange={(e) => setExtra("security", e.target.value)} /></label>
            <label>Cleaning Charges<input inputMode="numeric" value={extras.cleaning} placeholder="0" onChange={(e) => setExtra("cleaning", e.target.value)} /></label>
            <label>Dumping Charges<input inputMode="numeric" value={extras.dumping} placeholder="0" onChange={(e) => setExtra("dumping", e.target.value)} /></label>
            <label>Other Charges<input inputMode="numeric" value={extras.other} placeholder="0" onChange={(e) => setExtra("other", e.target.value)} /></label>
            <div className="mapp-extra-total"><span>Additional Charges Total</span><strong>{inr(additional)}</strong></div>
          </>
        ) : null}
      </section>
      <section className="mapp-card">
        <strong>Bill Summary</strong>
        <div className="mapp-bill"><span>Booking Amount</span><span>{inr(bookingAmount)}</span></div>
        <div className="mapp-bill"><span>Additional Charges</span><span>{inr(additional)}</span></div>
        <div className="mapp-bill"><span>Grand Total</span><strong>{inr(grand)}</strong></div>
      </section>
      <label className="mapp-check"><input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} /><span>{terms}</span></label>
      <button type="button" className="mapp-ghost" disabled={savingCharges} onClick={saveCharges}>{savingCharges ? "Saving…" : "Save Charges"}</button>
      {allow(role, "payment.receive") ? <button type="button" className="mapp-cta" onClick={save}>Collect Payment</button> : null}
      {allow(role, "invoice.generate") ? <button type="button" className="mapp-ghost" disabled={savingCharges} onClick={async () => { const ok = await saveCharges(); if (ok) onBill(); }}>Generate Final Bill</button> : null}
    </>
  );
}

function Guests({ state, dispatch, flash }) {
  const [query, setQuery] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "" });
  const [editing, setEditing] = useState(null);
  const rows = state.guests.filter((g) => `${g.name} ${g.phone}`.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <>
      <h1>Guests / CRM</h1>
      <input placeholder="Search guest by name or phone" value={query} onChange={(e) => setQuery(e.target.value)} />
      {rows.map((g) => (
        <article key={g.id} className="mapp-line">
          <span className="mapp-ico">👤</span>
          <span className="mapp-grow"><strong>{g.name}</strong><span className="sub">{g.phone}{g.email ? ` · ${g.email}` : ""}</span><span className="sub">{g.address} · {g.bookings} booking{g.bookings === 1 ? "" : "s"}</span></span>
          {allow(state.user?.role, "guest.edit") ? <button type="button" className="mapp-ghost" style={{ width: "auto" }} onClick={() => setEditing(g)}>Update</button> : null}
        </article>
      ))}
      {editing ? (
        <section className="mapp-card">
          <strong>Update {editing.name}</strong>
          <label>Name<input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></label>
          <label>Phone<input value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></label>
          <label>Email<input value={editing.email || ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></label>
          <label>Address<input value={editing.address || ""} onChange={(e) => setEditing({ ...editing, address: e.target.value })} /></label>
          <button type="button" className="mapp-cta" onClick={() => { commit({ type: "update-guest", guest: editing }); setEditing(null); flash("Guest details updated."); }}>Save guest</button>
        </section>
      ) : null}
      <h2>Add Guest</h2>
      <label>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
      <label>Phone<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
      <label>Email<input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
      <label>Address<input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
      <button type="button" className="mapp-cta" onClick={() => {
        if (!form.name || !form.phone) return;
        commit({ type: "add-guest", guest: form });
        setForm({ name: "", phone: "", email: "", address: "" });
        flash("Guest added to CRM.");
      }}>Add Guest</button>
    </>
  );
}

function Documents({ state, booking, dispatch, flash }) {
  const [kind, setKind] = useState("ID Proof");
  const [file, setFile] = useState("");
  const rows = state.documents.filter((d) => d.bookingNo === booking.no);
  return (
    <>
      <h1>Documents</h1>
      <p className="sub">{booking.no} · {booking.guest}</p>
      {["ID Proof", "Agreement", "GST Documents"].map((item) => (
        <button key={item} type="button" className="mapp-line" onClick={() => setKind(item)}>
          <span className="mapp-ico">📄</span>
          <span className="mapp-grow"><strong>{item}</strong><span className="sub">{rows.filter((d) => d.kind === item).map((d) => d.name).join(", ") || "None yet"}</span></span>
        </button>
      ))}
      <label>Upload {kind}
        <input type="file" accept="image/*,.pdf" onChange={(e) => setFile(e.target.files?.[0]?.name || "")} />
      </label>
      <button type="button" className="mapp-cta" onClick={() => {
        if (!file) return;
        commit({ type: "add-document", document: { bookingNo: booking.no, kind, name: file } });
        setFile("");
        flash("Document saved on this booking only. Not uploaded to the live desk.");
      }}>Save</button>
    </>
  );
}

function ReportSummary({ state, role, go }) {
  const blocks = [
    ["Day", "today"],
    ["Week", "week"],
    ["Month", "month"],
    ["6 months", "half"],
    ["Year", "year"],
  ].filter(([, key]) => role === "Owner" || key === "today" || key === "week" || key === "month").map(([label, key]) => ({ label, ...money(state, ...rangeFor(key)) }));
  const month = blocks.find((b) => b.label === "Month") || { byMode: {}, profit: 0 };
  const modes = ["Cash", "UPI", "Card", "Bank", "Advance", "Final"];
  const modeTotal = modes.reduce((n, m) => n + (month.byMode[m] || 0), 0) || 1;
  return (
    <>
      <h1>Report Summary</h1>
      <div className="mapp-chips">
        <button type="button" className="is-on">Summary</button>
        <button type="button" onClick={() => go("today")}>Today</button>
        <button type="button" onClick={() => go("period")}>Period</button>
      </div>
      <div className="mapp-kpis">
        {blocks.map((b) => (
          <article key={b.label} className="mapp-kpi"><span className="sub">{b.label} net collections</span><b>{inr(b.net)}</b></article>
        ))}
        {role === "Owner" ? <article className="mapp-kpi lilac"><span className="sub">Net profit (month)</span><b>{inr(month.profit)}</b></article> : null}
      </div>
      <h2>Payment split · this month</h2>
      {modes.map((mode) => (
        <div key={mode} className="mapp-bill"><span>{mode}</span><span>{inr(month.byMode[mode] || 0)} · {Math.round(((month.byMode[mode] || 0) / modeTotal) * 100)}%</span></div>
      ))}
    </>
  );
}

function TodayReport({ state, role, figures }) {
  const today = money(state, todayIso(), todayIso());
  const hall = today.pay.filter((p) => /imperial|garden|heritage|ballroom|pavilion|courtyard/i.test(p.hall)).reduce((n, p) => n + p.amount, 0);
  return (
    <>
      <h1>Today Report</h1>
      <p className="sub">{showDate(todayIso())}</p>
      <div className="mapp-kpis">
        <article className="mapp-kpi mint"><span className="sub">Today's Collection</span><b>{inr(figures.collectionToday)}</b></article>
        {role === "Owner" ? <article className="mapp-kpi rose"><span className="sub">Refunds</span><b>{inr(figures.refundsToday)}</b></article> : null}
        {role === "Owner" ? <article className="mapp-kpi"><span className="sub">Net Money</span><b>{inr(figures.netToday)}</b></article> : null}
        {role !== "Receptionist" ? <article className="mapp-kpi"><span className="sub">Hall Revenue</span><b>{inr(hall)}</b></article> : null}
        {role === "Owner" ? <article className="mapp-kpi"><span className="sub">Room Revenue</span><b>{inr(today.pay.filter((p) => /suite|deluxe|standard/i.test(p.hall)).reduce((n, p) => n + p.amount, 0))}</b></article> : null}
        {role === "Owner" ? <article className="mapp-kpi"><span className="sub">Food & Extras</span><b>{inr(today.expenses.filter((e) => /food|cater|extra/i.test(`${e.dept} ${e.type}`)).reduce((n, e) => n + e.amount, 0))}</b></article> : null}
        {role === "Owner" ? <article className="mapp-kpi peach"><span className="sub">Expenses</span><b>{inr(today.expense)}</b></article> : null}
        {allow(role, "dash.pending") ? <article className="mapp-kpi rose"><span className="sub">Pending Payments</span><b>{inr(figures.pending)}</b></article> : null}
      </div>
      <h2>Payment mode</h2>
      {["Cash", "UPI", "Card", "Bank"].map((mode) => <div key={mode} className="mapp-bill"><span>{mode}</span><span>{inr(figures.todayModes[mode] || 0)}</span></div>)}
    </>
  );
}

function PeriodReport({ state, role }) {
  const [key, setKey] = useState("month");
  const [from, setFrom] = useState("2026-09-01");
  const [to, setTo] = useState(todayIso);
  const active = key === "custom" ? [from, to] : rangeFor(key);
  const report = money(state, active[0], active[1]);
  const total = report.revenue || 1;
  const hallPay = report.pay.filter((p) => /imperial|garden|heritage|ballroom|pavilion|courtyard/i.test(p.hall)).reduce((n, p) => n + p.amount, 0);
  const roomPay = report.pay.filter((p) => /suite|deluxe|standard/i.test(p.hall)).reduce((n, p) => n + p.amount, 0);
  const foodPay = report.expenses.filter((e) => /food|cater|extra/i.test(`${e.dept} ${e.type}`)).reduce((n, e) => n + e.amount, 0);
  const lines = [
    ["Function Hall", hallPay],
    ["Rooms", roomPay],
    ["Food & Extras", foodPay],
  ];
  return (
    <>
      <h1>Period Report</h1>
      <div className="mapp-2">
        <label>From<input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setKey("custom"); }} /></label>
        <label>To<input type="date" value={to} onChange={(e) => { setTo(e.target.value); setKey("custom"); }} /></label>
      </div>
      <div className="mapp-chips">
        {[["today", "Today"], ["week", "This week"], ["month", "This month"], ["half", "6 months"], ["year", "Year"]].filter(([id]) => role === "Owner" || id === "today" || id === "week" || id === "month").map(([id, label]) => (
          <button key={id} type="button" className={key === id ? "is-on" : ""} onClick={() => { setKey(id); const [a, b] = rangeFor(id); setFrom(a); setTo(b); }}>{label}</button>
        ))}
      </div>
      <div className="mapp-kpis">
        <article className="mapp-kpi mint"><span className="sub">Total Revenue</span><b>{inr(report.revenue)}</b></article>
        {role === "Owner" ? <article className="mapp-kpi peach"><span className="sub">Total Expense</span><b>{inr(report.expense)}</b></article> : null}
        {role === "Owner" ? <article className="mapp-kpi lilac"><span className="sub">Net Profit</span><b>{inr(report.profit)}</b></article> : null}
      </div>
      <h2>Revenue by type</h2>
      {lines.map(([label, amount]) => <div key={label} className="mapp-bill"><span>{label}</span><span>{inr(amount)} · {Math.round((amount / total) * 100)}%</span></div>)}
      {role === "Owner" ? <button type="button" className="mapp-cta" onClick={() => download("gayatri-period-report.csv", `Period,${active[0]},${active[1]}\nRevenue,${report.revenue}\nExpense,${report.expense}\nProfit,${report.profit}\n`)}>Export Excel</button> : null}
      {role === "Owner" ? <button type="button" className="mapp-ghost" onClick={() => download("gayatri-period-report.txt", `Period ${active[0]} to ${active[1]}\nRevenue ${report.revenue}\nExpense ${report.expense}\nProfit ${report.profit}\n`)}>Export PDF</button> : null}
    </>
  );
}

const PAY_FILTERS = [
  ["all", "All"],
  ["paid", "Paid"],
  ["partial", "Partial Payment"],
  ["pending", "Payment Pending"],
  ["cancelled", "Cancelled"],
  ["refund", "Refund Processing"],
];

function PaymentBoard({ state, role, onTab, onOpen }) {
  const [filter, setFilter] = useState("all");
  const [draft, setDraft] = useState("all");
  const [open, setOpen] = useState(false);
  const rows = [...state.bookings].sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.guest).localeCompare(String(b.guest)));
  const standingOf = (booking) => payStanding(booking, state.refunds);
  const counts = { all: rows.length, paid: 0, partial: 0, pending: 0 };
  rows.forEach((booking) => {
    const key = standingOf(booking).key;
    if (counts[key] != null) counts[key] += 1;
  });
  const visible = rows.filter((booking) => filter === "all" || standingOf(booking).key === filter);
  return (
    <>
      <div className="mapp-row">
        <h1 style={{ margin: 0 }}>Payments</h1>
        <button type="button" className="mapp-filter" aria-label="Filter by payment status" onClick={() => { setDraft(filter); setOpen(true); }}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 5h16l-6 7v6l-4 2v-8z" /></svg>
        </button>
      </div>
      <PayNav role={role} current="payments" onTab={onTab} />
      <div className="mapp-paystats">
        {[
          ["all", "Total", ""],
          ["paid", "Paid", "paid"],
          ["partial", "Partial", "partial"],
          ["pending", "Pending", "pending"],
        ].map(([key, label, tone]) => (
          <button key={key} type="button" className={`mapp-paystat ${tone}${filter === key ? " is-on" : ""}`} onClick={() => setFilter(key)}>
            <span>{label}</span>
            <b>{counts[key]}</b>
          </button>
        ))}
      </div>
      {visible.map((booking) => {
        const standing = standingOf(booking);
        const hall = HALLS.find((item) => item.id === booking.hallId);
        return (
          <button key={booking.id} type="button" className="mapp-paycard" onClick={() => onOpen(booking.id)}>
            {hall ? <img src={hall.photo} alt="" /> : <span className="mapp-ico">🛏️</span>}
            <span className="mapp-grow">
              <span className="mapp-row"><strong>{placeName(booking)}</strong><span className={`mapp-badge is-${standing.key}`}>{standing.label}</span></span>
              <span className="sub">{booking.guest}</span>
              <span className="sub">{showDate(booking.date)} · {booking.guests} guests</span>
            </span>
          </button>
        );
      })}
      {!visible.length ? <p className="sub">No bookings for this payment status.</p> : null}
      {open ? (
        <div className="mapp-sheet" role="dialog" aria-label="Filter by payment status">
          <button type="button" className="mapp-sheet-back" aria-label="Close filter" onClick={() => setOpen(false)} />
          <div className="mapp-sheet-card">
            <div className="mapp-row"><strong>Filter by Payment Status</strong><button type="button" className="mapp-filter" aria-label="Close" onClick={() => setOpen(false)}>×</button></div>
            {PAY_FILTERS.map(([key, label]) => (
              <button key={key} type="button" className={`mapp-choice${draft === key ? " is-on" : ""}`} onClick={() => setDraft(key)}>
                <i className={`mapp-dot is-${key}`} />
                <span>{label}</span>
              </button>
            ))}
            <button type="button" className="mapp-cta" onClick={() => { setFilter(draft); setOpen(false); }}>Apply</button>
          </div>
        </div>
      ) : null}
    </>
  );
}

function paymentShareText(booking) {
  const bill = phoneBill(booking);
  const paid = Number(booking.paid) || 0;
  const due = Math.max(0, bill.total - paid);
  return [
    "Gayatri Convention",
    `${placeName(booking)} · ${booking.guest}`,
    showDate(booking.date),
    `Total ${inr(bill.total)}`,
    `Paid ${inr(paid)}`,
    `Due ${inr(due)}`,
  ].join("\n");
}

function PaymentDetail({ state, booking, role, onCollect }) {
  const [shareFile, setShareFile] = useState(null);
  const [shareNote, setShareNote] = useState("");
  useEffect(() => {
    setShareFile(null);
    setShareNote("");
  }, [booking?.no]);
  if (!booking) return <p className="sub">Open a booking from Payments.</p>;
  const standing = payStanding(booking, state.refunds);
  const bill = phoneBill(booking);
  const paid = Number(booking.paid) || 0;
  const due = Math.max(0, bill.total - paid);
  const hall = HALLS.find((item) => item.id === booking.hallId);
  const history = state.payments.filter((payment) => payment.bookingNo === booking.no);
  const statusLine = standing.key === "paid" ? "Fully Paid" : standing.key === "partial" ? "Advance Paid" : standing.label;
  const text = paymentShareText(booking);
  const prepareShare = async () => {
    setShareNote("");
    try {
      const file = await invoicePdfFile(booking, bill, placeName(booking), state.payments);
      setShareFile(file);
    } catch (err) {
      setShareNote(err?.message || "Could not prepare the invoice PDF.");
    }
  };
  const sendShare = async (app) => {
    if (!shareFile) return;
    const result = await shareInvoiceFile(shareFile, app, booking.phone);
    if (result === "fallback") setShareNote("Invoice PDF saved. Attach it in WhatsApp or Gmail if it did not attach automatically.");
  };
  return (
    <>
      <h1>Payment Details</h1>
      <article className="mapp-payhero">
        {hall ? <img src={hall.photo} alt="" /> : null}
        <div>
          <span className={`mapp-badge is-${standing.key}`}>{standing.label}</span>
          <strong>{placeName(booking)}</strong>
          <p className="sub">{booking.guest}</p>
          <p className="sub">{showDate(booking.date)} · {booking.guests} guests</p>
        </div>
      </article>
      <div className={`mapp-paybox is-${standing.key}`}>
        <span><span className="sub">Payment Status</span><strong>{statusLine}</strong></span>
        <span><span className="sub">Amount Paid</span><strong>{inr(paid)}</strong></span>
      </div>
      <h2>Event Details</h2>
      <div className="mapp-bill"><span>Hall / Venue</span><span>{placeName(booking)}</span></div>
      <div className="mapp-bill"><span>Event Type</span><span>{booking.package || "Function"}</span></div>
      <div className="mapp-bill"><span>Contact Person</span><span>{booking.guest}</span></div>
      <div className="mapp-bill"><span>Phone</span><span>{booking.phone || "—"}</span></div>
      <h2>Amount</h2>
      <div className="mapp-bill"><span>Total Amount</span><span>{inr(bill.total)}</span></div>
      <div className="mapp-bill"><span>Paid Amount</span><span>{inr(paid)}</span></div>
      <div className="mapp-bill"><span>Due Amount</span><span>{inr(due)}</span></div>
      <h2>Payment History</h2>
      {history.length ? history.map((payment) => (
        <div key={payment.id} className="mapp-hist">
          <span className={`mapp-badge is-${payment.kind === "refund" ? "refund" : "paid"}`}>{payment.kind === "refund" ? "Refund" : "Paid"}</span>
          <span className="mapp-grow">
            <strong>{payment.kind === "refund" ? "Refund" : "Payment"}</strong>
            <span className="sub">{showDate(payment.date)} · {payment.mode}</span>
          </span>
          <strong>{inr(payment.amount)}</strong>
        </div>
      )) : <p className="sub">No payment collected yet. Due {inr(due)}.</p>}
      {due > 0 ? <button type="button" className="mapp-cta" onClick={() => shareWhatsApp(`Payment reminder\n${text}`, booking.phone)}>Send Payment Reminder</button> : null}
      <button type="button" className="mapp-ghost" onClick={prepareShare}>Share Payment Details</button>
      {shareFile ? (
        <div className="mapp-share" aria-label="Share invoice PDF">
          <button type="button" aria-label="WhatsApp" onClick={() => sendShare("whatsapp")}>
            <svg viewBox="0 0 48 48" aria-hidden="true">
              <circle cx="24" cy="24" r="24" fill="#25D366" />
              <path fill="#fff" d="M24 12.5a11.2 11.2 0 0 0-9.6 16.9l-1.2 4.4 4.5-1.2A11.2 11.2 0 1 0 24 12.5zm6.5 15.9c-.3.8-1.6 1.5-2.2 1.6-.6.1-1.3.2-2.1-.1-.5-.2-1.1-.4-1.9-.8-3.3-1.4-5.5-4.8-5.6-5-.2-.3-1.3-1.7-1.3-3.3s.8-2.3 1.1-2.6c.3-.3.6-.4 1-.4h.7c.2 0 .5 0 .7.6.3.7 1 2.4 1.1 2.6.1.2.1.4 0 .6-.1.3-.2.4-.4.6l-.4.5c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.5.1.7-.1l.9-1.1c.2-.2.4-.2.7-.1l2.3 1.1c.3.1.5.2.5.4.1.3 0 .8-.2 1.5z" />
            </svg>
            <span>WhatsApp</span>
          </button>
          <button type="button" aria-label="Gmail" onClick={() => sendShare("gmail")}>
            <svg viewBox="0 0 48 48" aria-hidden="true">
              <rect width="48" height="48" rx="10" fill="#fff" />
              <path fill="#EA4335" d="M8 16.5 24 28l16-11.5V34a3 3 0 0 1-3 3H11a3 3 0 0 1-3-3z" />
              <path fill="#FBBC05" d="M8 16.5 24 28V13H11a3 3 0 0 0-3 3.5z" />
              <path fill="#34A853" d="M40 16.5 24 28V13h13a3 3 0 0 1 3 3.5z" />
              <path fill="#4285F4" d="M8 16.2v4.2L16 26V18z" />
              <path fill="#C5221F" d="M40 16.2v4.2L32 26V18z" />
            </svg>
            <span>Gmail</span>
          </button>
        </div>
      ) : null}
      {shareNote ? <p className="sub">{shareNote}</p> : null}
      {due > 0 && allow(role, "payment.receive") ? <button type="button" className="mapp-ghost" onClick={onCollect}>Collect Payment</button> : null}
    </>
  );
}

function PaymentLedger({ state, role, onTab, onOpen }) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("All");
  const [span, setSpan] = useState(role === "Receptionist" ? "today" : "month");
  const [from, to] = rangeFor(span);
  const rows = state.payments.filter((payment) => {
    const blob = `${payment.bookingNo} ${payment.guest} ${payment.hall}`.toLowerCase();
    return inSpan(payment.date, from, to) && (mode === "All" || payment.mode === mode) && blob.includes(query.trim().toLowerCase());
  });
  return (
    <>
      <h1>Payment History</h1>
      <PayNav role={role} current="history" onTab={onTab} />
      <input placeholder="Booking number, customer, or phone" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="mapp-chips">
        {["All", "Cash", "UPI", "Card", "Bank"].map((item) => <button key={item} type="button" className={mode === item ? "is-on" : ""} onClick={() => setMode(item)}>{item}</button>)}
      </div>
      {role === "Receptionist" ? null : (
        <div className="mapp-chips">
          {[["today", "Today"], ["week", "This week"], ["month", "This month"], ["year", "Year"]].filter(([id]) => role === "Owner" || id !== "year").map(([id, label]) => <button key={id} type="button" className={span === id ? "is-on" : ""} onClick={() => setSpan(id)}>{label}</button>)}
        </div>
      )}
      {rows.map((payment) => {
        const booking = state.bookings.find((item) => item.no === payment.bookingNo);
        return (
          <article key={payment.id} className="mapp-card">
            <div className="mapp-row">
              <strong>{payment.guest || payment.bookingNo}</strong>
              <strong>{inr(payment.amount)}</strong>
            </div>
            <p className="sub">{HALLS.find((item) => item.id === payment.hall)?.name || ROOM_TYPES.find((item) => item.id === payment.hall)?.name || payment.hall} · {payment.bookingNo}</p>
            <p className="sub">{showDate(payment.date)} · {payment.mode} · {payment.kind === "refund" ? "Refund" : "Paid"}{booking ? ` · Balance ${inr(Math.max(0, phoneBill(booking).total - (Number(booking.paid) || 0)))}` : ""}</p>
            <div className="mapp-actions">
              {booking ? <button type="button" onClick={() => onOpen(booking.id)}>View</button> : null}
              <button type="button" onClick={() => download(`${payment.bookingNo}.txt`, invoiceText(booking || { no: payment.bookingNo, guest: payment.guest, total: payment.amount, paid: payment.amount, hallId: payment.hall, date: payment.date }))}>Download Invoice</button>
              <button type="button" onClick={() => shareWhatsApp(`${payment.bookingNo} ${payment.guest} ${inr(payment.amount)} ${payment.mode}`, booking?.phone)}>WhatsApp</button>
            </div>
          </article>
        );
      })}
      {!rows.length ? <p className="sub">No payments in this period.</p> : null}
      {role === "Owner" ? <button type="button" className="mapp-cta" onClick={() => download("payments.csv", ["Booking,Guest,Hall,Amount,Mode,Date", ...rows.map((payment) => `${payment.bookingNo},${payment.guest},${payment.hall},${payment.amount},${payment.mode},${payment.date}`)].join("\n"))}>Export Excel</button> : null}
    </>
  );
}

function Register({ state, role, onTab, onOpen }) {
  const rows = [...state.bookings].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return (
    <>
      <h1>Payment Register</h1>
      <PayNav role={role} current="register" onTab={onTab} />
      {rows.map((booking) => {
        const bill = phoneBill(booking);
        const paid = Number(booking.paid) || 0;
        const due = Math.max(0, bill.total - paid);
        const refund = state.payments.filter((payment) => payment.bookingNo === booking.no && payment.kind === "refund").reduce((sum, payment) => sum + payment.amount, 0);
        const modes = [...new Set(state.payments.filter((payment) => payment.bookingNo === booking.no && payment.kind !== "refund" && payment.mode).map((payment) => payment.mode))];
        const standing = payStanding(booking, state.refunds);
        return (
          <button key={booking.id} type="button" className="mapp-card mapp-register" onClick={() => onOpen(booking.id)}>
            <div className="mapp-row"><strong>{booking.no}</strong><span className={`mapp-badge is-${standing.key}`}>{standing.short}</span></div>
            <p className="sub">{placeName(booking)} · {showDate(booking.date)}</p>
            <div className="mapp-bill"><span>Name</span><span>{booking.guest || "—"}</span></div>
            <div className="mapp-bill"><span>Payment mode</span><span>{modes.length ? modes.join(" · ") : "—"}</span></div>
            <div className="mapp-bill"><span>Amount</span><span>{inr(bill.amount)}</span></div>
            <div className="mapp-bill"><span>{bill.gstLabel}</span><span>{inr(bill.gst)}</span></div>
            <div className="mapp-bill"><span>Total</span><span>{inr(bill.total)}</span></div>
            <div className="mapp-bill"><span>Collected</span><span>{inr(paid)}</span></div>
            <div className="mapp-bill"><span>Refund</span><span>{inr(refund)}</span></div>
            <div className="mapp-bill"><span>Balance</span><span>{inr(due)}</span></div>
          </button>
        );
      })}
      {!rows.length ? <p className="sub">No bookings in the register.</p> : null}
    </>
  );
}

function ExpenseEntry({ existing, onSave }) {
  const [form, setForm] = useState(existing || { date: todayIso(), dept: "Hotel", type: "Diesel", by: "Owner", taken: "", amount: "", mode: "Cash", note: "", file: "" });
  return (
    <>
      <h1>Expense Entry</h1>
      <label>Date<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
      <label>Department
        <select value={form.dept} onChange={(e) => setForm({ ...form, dept: e.target.value })}>
          {["Hotel", "Utilities", "Others", "Food & Beverages", "Office"].map((x) => <option key={x}>{x}</option>)}
        </select>
      </label>
      <label>Expense type<input value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} /></label>
      <label>Given by<input value={form.by} onChange={(e) => setForm({ ...form, by: e.target.value })} /></label>
      <label>Taken by<input value={form.taken} onChange={(e) => setForm({ ...form, taken: e.target.value })} /></label>
      <label>Amount<input inputMode="numeric" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label>
      <label>Payment mode
        <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
          {["Cash", "UPI", "Card", "Bank"].map((x) => <option key={x}>{x}</option>)}
        </select>
      </label>
      <label>Notes<textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
      <label>Upload bill / receipt / GST invoice
        <input type="file" accept="image/*,.pdf" onChange={(e) => setForm({ ...form, file: e.target.files?.[0]?.name || "" })} />
      </label>
      <button type="button" className="mapp-cta" onClick={() => onSave({ ...form, amount: Number(form.amount) || 0 })}>Save Expense</button>
    </>
  );
}

function ExpenseList({ state, role, userId, onAdd, onEdit, onVerify, onApprove, onReject }) {
  const [from, setFrom] = useState("2026-09-01");
  const [to, setTo] = useState(todayIso);
  const [dept, setDept] = useState("All");
  const [type, setType] = useState("All");
  const [mode, setMode] = useState("All");
  const rows = state.expenses.filter((e) => inSpan(e.date, from, to) && (dept === "All" || e.dept === dept) && (type === "All" || e.type === type) && (mode === "All" || e.mode === mode));
  return (
    <>
      <h1>Expense List</h1>
      <div className="mapp-2">
        <label>From<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label>To<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
      </div>
      <label>Department
        <select value={dept} onChange={(e) => setDept(e.target.value)}><option>All</option>{["Hotel", "Utilities", "Others", "Food & Beverages", "Office"].map((x) => <option key={x}>{x}</option>)}</select>
      </label>
      <label>Expense type
        <select value={type} onChange={(e) => setType(e.target.value)}><option>All</option>{[...new Set(state.expenses.map((e) => e.type))].map((x) => <option key={x}>{x}</option>)}</select>
      </label>
      <label>Payment mode
        <select value={mode} onChange={(e) => setMode(e.target.value)}><option>All</option>{["Cash", "UPI", "Card", "Bank"].map((x) => <option key={x}>{x}</option>)}</select>
      </label>
      {rows.map((e) => (
        <article key={e.id} className="mapp-card">
          <div className="mapp-row"><strong>{e.type}</strong><strong>{inr(e.amount)}</strong></div>
          <p className="sub">{showDate(e.date)} · {e.dept} · {e.mode} · {e.status || "approved"} · {e.file ? "Receipt attached" : "No receipt"}</p>
          {role === "Manager" && e.addedBy === userId && e.status !== "approved" ? <p className="sub">You cannot approve your own expense. Waiting for the owner.</p> : null}
          <div className="mapp-actions">
            {role === "Owner" || (role === "Manager" && e.addedBy !== userId) ? <button type="button" onClick={() => onEdit(e.id)}>Edit</button> : null}
            {role === "Manager" && e.status === "pending" && e.addedBy !== userId ? <button type="button" onClick={() => onVerify(e.id)}>Verify</button> : null}
            {role === "Owner" && (e.status === "pending" || e.status === "verified") ? <button type="button" onClick={() => onApprove(e.id)}>Approve</button> : null}
            {role === "Owner" && e.status !== "approved" && e.status !== "rejected" ? <button type="button" onClick={() => onReject(e.id)}>Reject</button> : null}
            {e.file ? <button type="button" onClick={() => download(e.file, `${e.type} ${e.amount} ${e.date}`)}>Download receipt</button> : null}
          </div>
        </article>
      ))}
      {role === "Owner" ? <button type="button" className="mapp-cta" onClick={() => download("expenses.csv", ["Date,Type,Dept,Amount,Mode,Status", ...rows.map((e) => `${e.date},${e.type},${e.dept},${e.amount},${e.mode},${e.status}`)].join("\n"))}>Export Excel</button> : null}
      <button type="button" className="mapp-cta" onClick={onAdd}>Add Expense</button>
    </>
  );
}

function invoiceText(booking) {
  const bill = phoneBill(booking);
  const due = Math.max(0, bill.total - (Number(booking.paid) || 0));
  return [
    "Gayatri Convention",
    booking.no,
    booking.guest,
    placeName(booking),
    showDate(booking.date),
    `Amount ${inr(bill.amount)}`,
    `${bill.gstLabel} ${inr(bill.gst)}`,
    `Total ${inr(bill.total)}`,
    `Paid ${inr(booking.paid || 0)}`,
    `Balance ${inr(due)}`,
  ].join("\n");
}

function Invoice({ booking, role, payments }) {
  const bill = phoneBill(booking);
  const due = Math.max(0, bill.total - (Number(booking.paid) || 0));
  const text = invoiceText(booking);
  async function savePdf() {
    const file = await invoicePdfFile(booking, bill, placeName(booking), payments || []);
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
  return (
    <>
      <h1>Invoice</h1>
      <section className="mapp-card">
        <strong>{booking.no}</strong>
        <p className="sub">{booking.guest} · {booking.phone}</p>
        <p className="sub">{placeName(booking)} · {booking.package} · {showDate(booking.date)}</p>
        <div className="mapp-bill"><span>Amount</span><span>{inr(bill.amount)}</span></div>
        <div className="mapp-bill"><span>{bill.gstLabel}</span><span>{inr(bill.gst)}</span></div>
        <div className="mapp-bill"><strong>Total</strong><strong>{inr(bill.total)}</strong></div>
        <div className="mapp-bill"><span>Advance</span><span>{inr(booking.paid)}</span></div>
        <div className="mapp-bill"><span>Balance</span><span>{inr(due)}</span></div>
      </section>
      <button type="button" className="mapp-cta" onClick={savePdf}>Download PDF</button>
      <button type="button" className="mapp-ghost" onClick={() => window.print()}>Print Invoice</button>
      {role !== "Receptionist" ? <button type="button" className="mapp-ghost" onClick={() => shareWhatsApp(text)}>WhatsApp Share</button> : null}
    </>
  );
}

const PAGES = [
  ["home", "Dashboard"],
  ["reservations", "Reservations"],
  ["new", "New reservation"],
  ["calendar", "Calendar"],
  ["detail", "Booking details"],
  ["rooms", "Rooms booking"],
  ["room-avail", "Room availability"],
  ["pay", "Payment & invoice"],
  ["pay-detail", "Payment details"],
  ["guests", "Guests / CRM"],
  ["documents", "Documents"],
  ["reports", "Report summary"],
  ["today", "Today report"],
  ["period", "Period report"],
  ["pay-history", "Payments"],
  ["pay-ledger", "Payment history"],
  ["register", "Payment register"],
  ["expense", "Expense entry"],
  ["expense-list", "Expense list"],
];

function BackupDesk({ flash }) {
  const [fileText, setFileText] = useState("");
  const [result, setResult] = useState("");
  return (
    <>
      <h1>Backup and restore</h1>
      <p className="sub">Downloads the live desk. Restoring the same file does not create a second copy.</p>
      <button type="button" className="mapp-cta" onClick={async () => {
        const snap = await fetchDeskSnapshot();
        download("gayatri-desk-backup.json", JSON.stringify(snap), "application/json");
        flash("Backup downloaded.");
      }}>Download backup</button>
      <label>Restore file
        <input type="file" accept="application/json,.json" onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          file.text().then(setFileText);
        }} />
      </label>
      <button type="button" className="mapp-ghost" disabled={!fileText} onClick={async () => {
        try {
          const out = await api("/api/admin/backup/restore", { method: "POST", body: fileText });
          setResult(`Bookings restored ${out.bookingsRestored}. Already there ${out.bookingsAlreadyPresent}. Expenses restored ${out.expensesRestored}.`);
          flash("Restore finished.");
        } catch (err) {
          setResult(err.message || "Restore failed.");
        }
      }}>Restore backup</button>
      {result ? <p className="sub">{result}</p> : null}
    </>
  );
}

function AuditLog() {
  const [rows, setRows] = useState([]);
  const [note, setNote] = useState("Loading the audit log…");
  useEffect(() => {
    api("/api/admin/rbac/audit")
      .then((list) => {
        setRows(Array.isArray(list) ? list : []);
        setNote("");
      })
      .catch((err) => setNote(err.message || "Audit log is not available."));
  }, []);
  return (
    <>
      <h1>Audit log</h1>
      {note ? <p className="sub">{note}</p> : null}
      {rows.map((row) => (
        <article key={row.id} className="mapp-card">
          <strong>{row.action}</strong>
          <p className="sub">{row.detail}</p>
          <p className="sub">
            {row.createdAt ? new Date(row.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : ""}
            {row.ipAddress ? ` · IP ${row.ipAddress}` : ""}
          </p>
        </article>
      ))}
      {!note && !rows.length ? <p className="sub">No audit rows yet.</p> : null}
    </>
  );
}

function More({ state, go, onLogout, onCalendar }) {
  const role = state.user?.role;
  const links = [
    ["guests", "Guests / CRM", true],
    ["lead-status", "Lead Status", true],
    ["source", "Source", true],
    ["documents", "Documents", true],
    ["refunds", "Refunds", true],
    ["expense", role === "Receptionist" ? "Upload bill" : "Add expense", allow(role, "expense.add") || allow(role, "expense.submit")],
    ["register", "Payment register", role !== "Receptionist"],
    ["staff", "Staff", role === "Owner"],
    ["status", "Server status", role === "Owner"],
    ["settings", "Settings", role === "Owner"],
    ["backup", "Backup and restore", role === "Owner"],
    ["audit", "Audit log", role === "Owner"],
  ];
  return (
    <>
      <h1>More</h1>
      <section className="mapp-card">
        <strong>{state.user?.name}</strong>
        <p className="sub">{role} · {state.user?.phone}</p>
      </section>
      {links.filter(([, , show]) => show).map(([id, label]) => (
        <button key={id} type="button" className="mapp-line" onClick={() => go(id)}><span className="mapp-grow"><strong>{label}</strong></span></button>
      ))}
      <button type="button" className="mapp-line"><span className="mapp-grow"><strong>Help & support</strong><span className="sub">gayatriconventionandresorts@gmail.com</span></span></button>
      {role === "Owner" ? (
        <>
          <h2>All pages</h2>
          {PAGES.filter(([id]) => !links.some(([linkId, , show]) => show && linkId === id)).map(([id, label]) => (
            <button key={id} type="button" className="mapp-line" onClick={() => (id === "calendar" && onCalendar ? onCalendar() : go(id))}><span className="mapp-grow">{label}</span></button>
          ))}
        </>
      ) : null}
      <button type="button" className="mapp-cta" onClick={onLogout}>Logout</button>
    </>
  );
}

function RefundQueue({ state, dispatch, flash }) {
  const role = state.user?.role;
  return (
    <>
      <h1>Refunds</h1>
      <p className="sub">Receptionist request, manager verify, owner approve, then the refund is paid.</p>
      {state.refunds.map((refund) => (
        <article key={refund.id} className="mapp-card">
          <div className="mapp-row"><strong>{refund.bookingNo}</strong><strong>{inr(refund.amount)}</strong></div>
          <p className="sub">{refund.guest} · {refund.mode} · {refund.reason}</p>
          <p className="sub">Status · {refund.status} · requested by {refund.by}</p>
          <div className="mapp-actions">
            {role === "Manager" && refund.status === "requested" ? <button type="button" onClick={() => { commit({ type: "verify-refund", id: refund.id }); flash("Refund verified. The owner must approve it."); }}>Verify</button> : null}
            {role === "Owner" && refund.status === "verified" ? <button type="button" onClick={() => { commit({ type: "approve-refund", id: refund.id }); flash("Refund approved."); }}>Approve</button> : null}
            {role === "Owner" && refund.status === "approved" ? <button type="button" onClick={() => { commit({ type: "process-refund", id: refund.id }); flash("Refund processed and recorded."); }}>Mark processed</button> : null}
          </div>
        </article>
      ))}
      {!state.refunds.length ? <p className="sub">No refund requests.</p> : null}
    </>
  );
}

function StaffAdmin() {
  return (
    <>
      <h1>Staff</h1>
      <p className="sub">Use the staff accounts already created on the desk. This phone does not keep a separate login.</p>
    </>
  );
}

function Settings({ state, dispatch, flash, onClear }) {
  const [property, setProperty] = useState(state.settings.property);
  const [refundNote, setRefundNote] = useState(state.settings.refundNote);
  return (
    <>
      <h1>Settings</h1>
      <label>Property name<input value={property} onChange={(e) => setProperty(e.target.value)} /></label>
      <label>Refund rule<input value={refundNote} onChange={(e) => setRefundNote(e.target.value)} /></label>
      <button type="button" className="mapp-cta" onClick={() => { dispatch({ type: "update-settings", settings: { property, refundNote } }); flash("Settings saved on this phone preview."); }}>Save settings</button>
      <section className="mapp-card">
        <strong>Clear bookings and payments</strong>
        <p className="sub">Removes every booking and payment from the shared desk. The website staff desk reads the same records and updates on its own.</p>
        <button type="button" className="mapp-ghost" onClick={() => onClear().catch((err) => flash(err.message || "Clear failed."))}>Clear all bookings and payments</button>
      </section>
      <section className="mapp-card">
        <strong>Protected rules</strong>
        <p className="sub">Only the owner can add a manager or receptionist, disable a login, approve a refund, and approve an expense.</p>
        <p className="sub">A receptionist cannot delete bookings, delete payments, approve refunds, view net profit, or open settings.</p>
        <p className="sub">A manager cannot view net profit or manage staff. A manager cannot approve their own expense.</p>
      </section>
    </>
  );
}
