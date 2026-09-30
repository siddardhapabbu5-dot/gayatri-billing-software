import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { clearAuth, getToken, healthCheck, login } from "../api/client.js";
import { fetchDeskSnapshot } from "../api/ops.js";
import { pushPhoneAction, savesToDesk, snapshotToPhone } from "./deskSync.js";
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

function statusText(booking) {
  if (booking.approval === "manager") return "Manager review";
  if (booking.approval === "owner") return "Owner review";
  return booking.status;
}

function statusClass(booking) {
  if (booking.approval === "manager" || booking.approval === "owner") return "is-review";
  return `is-${String(booking.status || "").toLowerCase()}`;
}

function monthCells(year, month) {
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: first }, () => null);
  for (let d = 1; d <= days; d += 1) cells.push(d);
  while (cells.length % 7) cells.push(null);
  return cells;
}

function download(name, text) {
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function shareWhatsApp(text) {
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
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
  const [state, dispatch] = useReducer(reducer, initialState);
  const [stack, setStack] = useState(["login"]);
  const [notice, setNotice] = useState("");
  const [alerts, setAlerts] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginNote, setLoginNote] = useState("");
  const [selectedId, setSelectedId] = useState("b1");
  const [draft, setDraft] = useState(null);
  const [expenseId, setExpenseId] = useState(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const screen = stack[stack.length - 1];
  const role = state.user?.role || "";
  const figures = useMemo(() => kpis(state), [state]);
  const booking = state.bookings.find((b) => b.id === selectedId) || state.bookings[0];

  function commit(action) {
    if (!savesToDesk(action.type) || !getToken()) {
      dispatch(action);
      return;
    }
    pushPhoneAction(action, stateRef.current)
      .then(() => fetchDeskSnapshot())
      .then((snap) => commit({ type: "hydrate", patch: snapshotToPhone(snap) }))
      .catch((err) => setNotice(err.message || "The staff desk did not save this."));
  }

  useEffect(() => {
    if (!state.user || !getToken()) return undefined;
    let stop = false;
    async function pull() {
      try {
        const snap = await fetchDeskSnapshot();
        if (!stop) commit({ type: "hydrate", patch: snapshotToPhone(snap) });
      } catch {
        /* Keep the last desk copy if this refresh fails. */
      }
    }
    pull();
    const timer = setInterval(pull, 15000);
    window.addEventListener("focus", pull);
    return () => {
      stop = true;
      clearInterval(timer);
      window.removeEventListener("focus", pull);
    };
  }, [state.user]);

  function go(next) {
    if (state.user && !screenAllowed(state.user.role, next)) {
      setNotice("This page is not available for your login.");
      return;
    }
    setNotice("");
    setStack((s) => [...s, next]);
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
          : ["pay", "pay-history", "register", "invoice"].includes(screen) ? (role === "Receptionist" ? "payments" : "finance")
            : ["expense", "expense-list"].includes(screen) ? (role === "Receptionist" ? "more" : "finance")
              : "more";

  return (
    <div className="mapp">
      <div className="mapp-frame">
        <p className="mapp-banner">{state.linked ? "Synced with the staff desk." : "Same login as the staff desk."}</p>
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
                const up = await healthCheck();
                if (!up) {
                  setLoginNote("The staff desk is offline. Sign in when the desk is reachable.");
                  return;
                }
                const out = await login(email.trim(), password);
                const user = phoneUserFromStaff(out.user);
                dispatch({ type: "login", user });
                const snap = await fetchDeskSnapshot();
                dispatch({ type: "hydrate", patch: snapshotToPhone(snap) });
                setPassword("");
                setStack(["home"]);
              } catch (err) {
                setLoginNote(err.message || "Wrong email or password.");
              }
            }}
          />
        ) : (
          <>
            <Top title={screen === "home" ? "" : ""} onBack={stack.length > 1 ? back : null} onBell={() => setAlerts(true)} />
            <main className="mapp-body">
              {notice ? <p className="mapp-note">{notice}</p> : null}
              {state.user && !screenAllowed(role, screen) ? <p className="mapp-note">This page is not available for the {role} login.</p> : null}
              {screen === "home" && <Dashboard state={state} figures={figures} go={go} flash={flash} dispatch={commit} />}
              {screen === "reservations" && <ReservationList state={state} onOpen={openBooking} onNew={() => go("new")} dispatch={commit} flash={flash} />}
              {screen === "new" && (
                <NewReservation
                  onHall={(hallId) => { setDraft({ hallId, roomId: "", date: TODAY, slot: "9:00 AM", guests: 2, package: "Half Day", requirements: [], guest: "", phone: "", email: "", gst: "", address: "" }); go("calendar"); }}
                  onRooms={() => go("rooms")}
                />
              )}
              {screen === "calendar" && <Calendar state={state} draft={draft} setDraft={setDraft} onContinue={() => go("detail")} />}
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
              {screen === "room-avail" && <RoomAvailability state={state} onPick={(roomId) => { setDraft({ hallId: "", roomId, date: TODAY, slot: "2:00 PM", guests: 2, package: "Night", requirements: [], guest: "", phone: "", email: "", gst: "", address: "" }); go("detail"); }} />}
              {screen === "pay" && (
                <Payment
                  role={role}
                  booking={booking}
                  onCollect={(amount, mode) => {
                    commit({ type: "add-payment", bookingId: booking.id, amount, mode, date: TODAY });
                    flash("Payment received. Saved payments cannot be edited.");
                  }}
                  onRefund={(amount, mode, reason) => {
                    commit({ type: "request-refund", bookingId: booking.id, amount, mode, reason });
                    flash("Refund requested. Manager verifies it, then the owner approves it.");
                  }}
                  onCancel={back}
                  onNext={() => go(role === "Receptionist" ? "invoice" : "guests")}
                  onQueue={() => go("refunds")}
                />
              )}
              {screen === "guests" && <Guests state={state} dispatch={commit} flash={flash} />}
              {screen === "documents" && <Documents state={state} booking={booking} dispatch={commit} flash={flash} />}
              {screen === "reports" && screenAllowed(role, screen) && <ReportSummary state={state} role={role} go={go} />}
              {screen === "today" && screenAllowed(role, screen) && <TodayReport state={state} role={role} figures={figures} />}
              {screen === "period" && screenAllowed(role, screen) && <PeriodReport state={state} role={role} />}
              {screen === "pay-history" && <PaymentHistory state={state} role={role} go={go} onOpen={openBooking} onCollect={() => go("pay")} />}
              {screen === "register" && screenAllowed(role, screen) && <Register state={state} role={role} />}
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
              {screen === "invoice" && <Invoice booking={booking} role={role} />}
              {screen === "refunds" && <RefundQueue state={state} dispatch={commit} flash={flash} />}
              {screen === "staff" && role === "Owner" && <StaffAdmin state={state} dispatch={commit} flash={flash} />}
              {screen === "settings" && role === "Owner" && <Settings state={state} dispatch={commit} flash={flash} />}
              {screen === "more" && <More state={state} go={go} onLogout={() => { clearAuth(); commit({ type: "logout" }); setPassword(""); setStack(["login"]); }} />}
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
          <div className="mapp-card" style={{ position: "absolute", left: 12, right: 12, top: 88, zIndex: 3 }} onClick={() => setAlerts(false)}>
            <strong>Alerts</strong>
            <p className="sub">{allow(role, "profit") || role === "Owner" || role === "Manager" ? `Pending payments ${inr(figures.pending)}.` : "No new alerts."}</p>
            <button type="button" className="mapp-cta" onClick={() => setAlerts(false)}>Close</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Login({ email, setEmail, password, setPassword, note, busy = false, onLogin }) {
  return (
    <div className="mapp-login">
      <div className="mapp-brand">
        <img src="/site/images/logo-gold.png" alt="" />
        <span>GAYATRI</span>
        <small>Venues & Convention</small>
      </div>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Enter the desk</h2>
        <p className="sub">Sign in with the same staff account used on the computer</p>
        <label>Email
          <input type="email" value={email} autoComplete="username" onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>Password
          <input type="password" value={password} autoComplete="current-password" onChange={(e) => setPassword(e.target.value)} />
        </label>
        <button type="button" className="mapp-cta" onClick={onLogin} disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        {note ? <p className="sub">{note}</p> : null}
      </div>
    </div>
  );
}

function Dashboard({ state, figures, go, dispatch, flash }) {
  const role = state.user?.role;
  const todayBookings = state.bookings.filter((b) => b.date === TODAY && b.status !== "Cancelled");
  const upcoming = state.bookings.filter((b) => b.date >= TODAY && b.status === "Confirmed").slice(0, 3);
  const reviewCount = state.bookings.filter((b) => b.approval === "manager").length;
  const ownerCount = state.bookings.filter((b) => b.approval === "owner").length;
  return (
    <>
      <p className="mapp-hello">Good Morning<strong>{state.user?.name}</strong><span className="sub">{state.user?.phone}</span></p>
      <div className="mapp-kpis">
        {allow(role, "dash.collection") ? <button type="button" className="mapp-kpi mint" onClick={() => go("today")}><span className="sub">Today's Collection</span><b>{inr(figures.collectionToday)}</b></button> : null}
        {allow(role, "dash.bookings") ? <button type="button" className="mapp-kpi blue" onClick={() => go("reservations")}><span className="sub">Today's Bookings</span><b>{figures.bookingsToday}</b></button> : null}
        {allow(role, "dash.pending") ? <button type="button" className="mapp-kpi rose" onClick={() => go("pay-history")}><span className="sub">Pending Payments</span><b>{inr(figures.pending)}</b></button> : null}
        {role === "Owner" ? <button type="button" className="mapp-kpi mint" onClick={() => go("reports")}><span className="sub">Monthly Revenue</span><b>{inr(figures.revenueMonth)}</b></button> : null}
        {role === "Owner" ? <button type="button" className="mapp-kpi peach" onClick={() => go("expense-list")}><span className="sub">Monthly Expenses</span><b>{inr(figures.expensesMonth)}</b></button> : null}
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
          <div className="mapp-row"><strong>Upcoming Events</strong><button type="button" className="mapp-ghost" style={{ width: "auto", margin: 0 }} onClick={() => go("reservations")}>View all</button></div>
          {upcoming.map((b) => (
            <p key={b.id} className="sub" style={{ marginTop: 8 }}>{hallName(b.hallId)} · {b.guest} · {showDate(b.date)} · {b.guests} guests</p>
          ))}
        </section>
      )}
    </>
  );
}

function ReservationList({ state, onOpen, onNew, dispatch, flash }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const rows = state.bookings.filter((b) => {
    const blob = `${b.no} ${b.guest} ${b.phone} ${hallName(b.hallId)}`.toLowerCase();
    return (status === "All" || b.status === status) && blob.includes(query.trim().toLowerCase());
  });
  return (
    <>
      <h1>Reservations</h1>
      <input placeholder="Search by name, phone, or booking no." value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="mapp-chips">
        {["All", "Confirmed", "Pending", "Cancelled", "Completed"].map((item) => (
          <button key={item} type="button" className={status === item ? "is-on" : ""} onClick={() => setStatus(item)}>{item}</button>
        ))}
      </div>
      {rows.map((b) => (
        <button key={b.id} type="button" className="mapp-res" onClick={() => onOpen(b.id)}>
          <span className="mapp-ico">⌂</span>
          <span className="mapp-grow">
            <strong>{hallName(b.hallId)}</strong>
            <span className="sub">{b.guest} · {b.no}</span>
            <span className="sub">{showDate(b.date)} · Advance {inr(b.paid)} · Balance {inr(balanceOf(b))}</span>
          </span>
          <span className="mapp-end">
            <strong>{inr(b.total)}</strong>
            <span className={`mapp-status ${statusClass(b)}`}>{statusText(b)}</span>
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

function NewReservation({ onHall, onRooms }) {
  const [space, setSpace] = useState("halls");
  const [hallId, setHallId] = useState("imperial");
  return (
    <>
      <h1>New Reservation</h1>
      <div className="mapp-seg">
        <button type="button" className={space === "halls" ? "is-on" : ""} onClick={() => setSpace("halls")}>Function Halls</button>
        <button type="button" className={space === "rooms" ? "is-on" : ""} onClick={() => setSpace("rooms")}>Rooms</button>
      </div>
      {space === "halls" ? HALLS.map((h) => (
        <button key={h.id} type="button" className={`mapp-hall${hallId === h.id ? " is-on" : ""}`} onClick={() => setHallId(h.id)}>
          <img src={h.photo} alt="" />
          <span><strong>{h.name}</strong><span className="sub" style={{ display: "block" }}>{h.meta}</span><span className="free">Free</span></span>
        </button>
      )) : ROOM_TYPES.map((r) => (
        <article key={r.id} className="mapp-line">
          <span className="mapp-ico">🛏️</span>
          <span className="mapp-grow"><strong>{r.name}</strong><span className="sub">{r.count} rooms</span></span>
        </article>
      ))}
      {space === "halls"
        ? <button type="button" className="mapp-cta" onClick={() => onHall(hallId)}>Proceed to Guest Details</button>
        : <button type="button" className="mapp-cta" onClick={onRooms}>Continue</button>}
    </>
  );
}

function Calendar({ state, draft, setDraft, onContinue }) {
  const [cursor, setCursor] = useState({ y: 2026, m: 8 });
  if (!draft) return <p className="sub">Choose a hall from New Reservation first.</p>;
  const cells = monthCells(cursor.y, cursor.m);
  const label = new Date(cursor.y, cursor.m, 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
  const booked = new Set(state.bookings.filter((b) => b.hallId && b.hallId === draft?.hallId && b.status !== "Cancelled").map((b) => Number(b.date.slice(8))));
  const day = Number((draft?.date || TODAY).slice(8));
  const slots = ["9:00 AM", "12:00 PM", "3:00 PM", "6:00 PM", "9:00 PM"];
  return (
    <>
      <h1>Availability</h1>
      <p className="sub">{draft?.hallId ? hallName(draft.hallId) : "Rooms"}</p>
      <section className="mapp-card">
        <div className="mapp-row">
          <button type="button" className="mapp-ghost" style={{ width: "auto" }} onClick={() => setCursor((c) => ({ y: new Date(c.y, c.m - 1, 1).getFullYear(), m: new Date(c.y, c.m - 1, 1).getMonth() }))}>‹</button>
          <strong>{label}</strong>
          <button type="button" className="mapp-ghost" style={{ width: "auto" }} onClick={() => setCursor((c) => ({ y: new Date(c.y, c.m + 1, 1).getFullYear(), m: new Date(c.y, c.m + 1, 1).getMonth() }))}>›</button>
        </div>
        <div className="mapp-cal">{"SUN MON TUE WED THU FRI SAT".split(" ").map((d) => <span key={d}>{d}</span>)}</div>
        <div className="mapp-days">
          {cells.map((d, i) => (
            <button key={`${d}-${i}`} type="button" disabled={!d} className={`${d === day ? "is-on" : ""} ${d && cursor.m === 8 && cursor.y === 2026 && booked.has(d) ? "is-booked" : ""}`} onClick={() => d && setDraft({ ...draft, date: `${cursor.y}-${String(cursor.m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` })}>{d || ""}</button>
          ))}
        </div>
        <div className="mapp-legend"><span><i style={{ background: "#1f7a4d" }} /> Available</span><span><i style={{ background: "#c4473a" }} /> Booked</span><span><i style={{ background: "#0e3d32" }} /> Selected</span></div>
      </section>
      <h2>Available Time Slots</h2>
      <div className="mapp-slots">
        {slots.map((slot) => <button key={slot} type="button" className={`mapp-slot${draft?.slot === slot ? " is-on" : ""}`} onClick={() => setDraft({ ...draft, slot })}>{slot}</button>)}
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
  const total = Number(form.total) || packages.find((p) => p[0] === form.package)?.[1] || packages[0][1];
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
        <span><strong>{hall?.name || room?.name}</strong><span className="sub" style={{ display: "block" }}>{hall?.meta || room?.name}</span><span className="free">{form.status || "Free"}</span></span>
      </article>
      <label>Guest name<input value={form.guest || ""} readOnly={!canEdit} onChange={(e) => patch({ guest: e.target.value })} /></label>
      <label>Phone<input value={form.phone || ""} readOnly={!canEdit} onChange={(e) => patch({ phone: e.target.value })} /></label>
      <label>GST<input value={form.gst || ""} readOnly={!canEdit} onChange={(e) => patch({ gst: e.target.value })} /></label>
      <label>Address<input value={form.address || ""} readOnly={!canEdit} onChange={(e) => patch({ address: e.target.value })} /></label>
      <label>Guests<input value={form.guests || ""} readOnly={!canEdit} onChange={(e) => patch({ guests: e.target.value })} /></label>
      <p className="sub">Date & time · {showDate(form.date)} · {form.slot || "9:00 AM"}</p>
      <div className="mapp-chips">
        {packages.map(([label, amount]) => (
          <button key={label} type="button" className={form.package === label ? "is-on" : ""} disabled={!canEdit} onClick={() => patch({ package: label, total: amount })}>{label} {inr(amount)}</button>
        ))}
      </div>
      <div className="mapp-chips">
        {["Decoration", "Catering", "Audio System"].map((item) => {
          const on = (form.requirements || []).includes(item);
          return <button key={item} type="button" className={on ? "is-on" : ""} disabled={!canEdit} onClick={() => patch({ requirements: on ? form.requirements.filter((x) => x !== item) : [...(form.requirements || []), item] })}>{item}</button>;
        })}
      </div>
      <div className="mapp-bill"><span>Total Amount</span><strong>{inr(total)}</strong></div>
      {!draft ? <div className="mapp-bill"><span>Advance / paid</span><span>{inr(form.paid)}</span></div> : null}
      {!draft ? <div className="mapp-bill"><span>Balance</span><span>{inr(balanceOf(form))}</span></div> : null}
      {canEdit ? <button type="button" className="mapp-cta" onClick={() => onSave({ ...form, total, paid: form.paid || 0, status: form.status || "Pending", guest: form.guest || "Guest", phone: form.phone || "" })}>{draft ? "Save booking" : "Save changes"}</button> : null}
      {!draft && allow(role, "payment.receive") ? <button type="button" className="mapp-ghost" onClick={onPay}>Proceed to Payment</button> : null}
      {!draft && (allow(role, "invoice.print") || allow(role, "invoice.generate")) ? <button type="button" className="mapp-ghost" onClick={onInvoice}>{role === "Receptionist" ? "Print invoice" : "Invoice, PDF, WhatsApp"}</button> : null}
      {!draft && role === "Manager" && form.approval === "manager" ? <button type="button" className="mapp-ghost" onClick={onReview}>Manager review</button> : null}
      {!draft && role === "Owner" && (form.approval === "owner" || form.approval === "manager") ? <button type="button" className="mapp-ghost" onClick={onConfirm}>Owner confirm</button> : null}
      {!draft && role === "Receptionist" && form.date === TODAY && form.status !== "Cancelled" && form.stay !== "in" && form.stay !== "out" ? <button type="button" className="mapp-ghost" onClick={onCheckIn}>Check in</button> : null}
      {!draft && role === "Receptionist" && form.stay === "in" ? <button type="button" className="mapp-ghost" onClick={onCheckOut}>Check out</button> : null}
      {!draft && role === "Owner" && form.status !== "Cancelled" ? <button type="button" className="mapp-ghost" onClick={onCancel}>Cancel booking</button> : null}
      {!draft && role === "Owner" ? <button type="button" className="mapp-ghost" onClick={onDelete}>Delete booking</button> : null}
    </>
  );
}

function RoomsBooking({ state, onContinue }) {
  return (
    <>
      <h1>Rooms Booking</h1>
      {ROOM_TYPES.map((r) => {
        const used = state.occupied[r.id] || 0;
        const freeCount = r.count - used;
        return (
          <article key={r.id} className="mapp-line">
            <span className="mapp-ico">🛏️</span>
            <span className="mapp-grow"><strong>{r.name}</strong><span className="sub">{r.count} rooms · {used} occupied</span><span className={freeCount ? "free" : "occ"}>{freeCount ? `${freeCount} available` : "Occupied"}</span></span>
          </article>
        );
      })}
      <p className="mapp-note">Select a room type on the next screen. Occupied rooms update when a room booking is saved.</p>
      <button type="button" className="mapp-cta" onClick={onContinue}>Continue</button>
    </>
  );
}

function RoomAvailability({ state, onPick }) {
  const [tab, setTab] = useState("all");
  const [day, setDay] = useState(0);
  const dates = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(2026, 8, 30 + i);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  });
  const rooms = ROOM_TYPES.filter((r) => (tab === "ac" ? r.ac : tab === "nonac" ? !r.ac : true));
  return (
    <>
      <h1>Room Availability</h1>
      <div className="mapp-chips">{dates.map((d, i) => <button key={d} type="button" className={day === i ? "is-on" : ""} onClick={() => setDay(i)}>{d}</button>)}</div>
      <div className="mapp-seg cols3">
        <button type="button" className={tab === "all" ? "is-on" : ""} onClick={() => setTab("all")}>All</button>
        <button type="button" className={tab === "ac" ? "is-on" : ""} onClick={() => setTab("ac")}>AC Rooms</button>
        <button type="button" className={tab === "nonac" ? "is-on" : ""} onClick={() => setTab("nonac")}>Non AC</button>
      </div>
      {rooms.length === 0 ? <p className="sub">No non-AC rooms.</p> : null}
      {rooms.map((r) => {
        const freeCount = r.count - (state.occupied[r.id] || 0);
        return (
          <button key={r.id} type="button" className="mapp-line" onClick={() => freeCount && onPick(r.id)}>
            <span className="mapp-ico">🛏️</span>
            <span className="mapp-grow"><strong>{r.name}</strong><span className="sub">{r.count} rooms</span><span className={freeCount ? "free" : "occ"}>{freeCount ? "Available" : "Occupied"}</span></span>
            <strong>{inr(r.rate)} / night</strong>
          </button>
        );
      })}
    </>
  );
}

function Payment({ role, booking, onCollect, onRefund, onCancel, onNext, onQueue }) {
  const [mode, setMode] = useState("Cash");
  const [amount, setAmount] = useState(String(Math.min(balanceOf(booking), Math.round((booking.total || 0) * 0.3)) || ""));
  const [invoice, setInvoice] = useState(true);
  const [refundAmount, setRefundAmount] = useState("");
  const [reason, setReason] = useState("");
  const tax = gstSplit(booking.total || 0);
  return (
    <>
      <h1>Payment & Invoice</h1>
      <h2>Payment Mode</h2>
      <div className="mapp-chips">{["Cash", "UPI", "Card", "Bank"].map((item) => <button key={item} type="button" className={mode === item ? "is-on" : ""} onClick={() => setMode(item)}>{item}</button>)}</div>
      <h2>Amount Details</h2>
      <div className="mapp-bill"><span>Total Amount</span><span>{inr(booking.total)}</span></div>
      <div className="mapp-bill"><span>GST included</span><span>{inr(tax.cgst + tax.sgst)}</span></div>
      <div className="mapp-bill"><span>Advance / paid</span><span>{inr(booking.paid)}</span></div>
      <div className="mapp-bill"><span>Balance</span><span>{inr(balanceOf(booking))}</span></div>
      <label>Collect now<input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
      <button type="button" className="mapp-cta" onClick={() => onCollect(Number(amount), mode === "Bank" ? "Bank" : mode)}>Collect Payment</button>
      {allow(role, "invoice.generate") ? <div className="mapp-row" style={{ marginTop: 12 }}><span>Generate Invoice</span><button type="button" className={invoice ? "mapp-cta" : "mapp-ghost"} style={{ width: "auto" }} onClick={() => setInvoice((v) => !v)}>{invoice ? "On" : "Off"}</button></div> : null}
      {allow(role, "refund.request") ? (
        <section className="mapp-card">
          <strong>Request refund</strong>
          <p className="sub">A receptionist cannot refund directly. Manager verifies, then the owner approves.</p>
          <label>Amount<input inputMode="numeric" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} /></label>
          <label>Reason<input value={reason} onChange={(e) => setReason(e.target.value)} /></label>
          <button type="button" className="mapp-ghost" onClick={() => onRefund(Number(refundAmount), mode, reason)}>Request refund</button>
        </section>
      ) : null}
      {role === "Manager" ? <p className="mapp-note">Refunds need owner approval. You can verify a request, not pay it.</p> : null}
      {(role === "Owner" || role === "Manager") ? <button type="button" className="mapp-ghost" onClick={onQueue}>Refund queue</button> : null}
      <div className="mapp-2">
        <button type="button" className="mapp-ghost" onClick={onCancel}>Cancel</button>
        <button type="button" className="mapp-cta" onClick={onNext}>{role === "Receptionist" ? "Print invoice" : "Next"}</button>
      </div>
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
  const month = blocks.find((b) => b.label === "Month");
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
  const today = money(state, TODAY, TODAY);
  const hall = today.pay.filter((p) => /imperial|garden|heritage|ballroom|pavilion|courtyard/i.test(p.hall)).reduce((n, p) => n + p.amount, 0);
  return (
    <>
      <h1>Today Report</h1>
      <p className="sub">{showDate(TODAY)}</p>
      <div className="mapp-kpis">
        <article className="mapp-kpi mint"><span className="sub">Today's Collection</span><b>{inr(figures.collectionToday)}</b></article>
        {role === "Owner" ? <article className="mapp-kpi rose"><span className="sub">Refunds</span><b>{inr(figures.refundsToday)}</b></article> : null}
        {role === "Owner" ? <article className="mapp-kpi"><span className="sub">Net Money</span><b>{inr(figures.netToday)}</b></article> : null}
        {role !== "Receptionist" ? <article className="mapp-kpi"><span className="sub">Hall Revenue</span><b>{inr(hall)}</b></article> : null}
        {role === "Owner" ? <article className="mapp-kpi"><span className="sub">Room Revenue</span><b>{inr(today.pay.filter((p) => /suite|deluxe|standard/i.test(p.hall)).reduce((n, p) => n + p.amount, 0))}</b></article> : null}
        {role === "Owner" ? <article className="mapp-kpi"><span className="sub">Food & Extras</span><b>{inr(0)}</b></article> : null}
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
  const [to, setTo] = useState(TODAY);
  const active = key === "custom" ? [from, to] : rangeFor(key);
  const report = money(state, active[0], active[1]);
  const total = report.revenue || 1;
  const lines = [
    ["Function Hall", report.revenue],
    ["Rooms", 0],
    ["Food & Extras", 0],
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

function PaymentHistory({ state, role, go, onOpen, onCollect }) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("All");
  const [span, setSpan] = useState(role === "Receptionist" ? "today" : "month");
  const [from, to] = rangeFor(span);
  const rows = state.payments.filter((p) => {
    const blob = `${p.bookingNo} ${p.guest} ${p.hall}`.toLowerCase();
    return inSpan(p.date, from, to) && (mode === "All" || p.mode === mode) && blob.includes(query.trim().toLowerCase());
  });
  return (
    <>
      <h1>Payment History</h1>
      <div className="mapp-chips">
        <button type="button" className="is-on">History</button>
        {role !== "Receptionist" ? <button type="button" onClick={() => go("register")}>Register</button> : null}
        {allow(role, "expense.add") || role === "Owner" ? <button type="button" onClick={() => go("expense")}>Expense</button> : null}
        {role !== "Receptionist" ? <button type="button" onClick={() => go("expense-list")}>Expense list</button> : null}
        {allow(role, "payment.receive") ? <button type="button" onClick={onCollect}>Receive payment</button> : null}
      </div>
      <input placeholder="Booking number, customer, or phone" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="mapp-chips">
        {["All", "Cash", "UPI", "Card", "Bank"].map((item) => <button key={item} type="button" className={mode === item ? "is-on" : ""} onClick={() => setMode(item)}>{item}</button>)}
      </div>
      {role === "Receptionist" ? null : (
        <div className="mapp-chips">
          {[["today", "Today"], ["week", "This week"], ["month", "This month"], ["year", "Year"]].filter(([id]) => role === "Owner" || id !== "year").map(([id, label]) => <button key={id} type="button" className={span === id ? "is-on" : ""} onClick={() => setSpan(id)}>{label}</button>)}
        </div>
      )}
      {rows.map((p) => {
        const booking = state.bookings.find((b) => b.no === p.bookingNo);
        return (
          <article key={p.id} className="mapp-card">
            <div className="mapp-row"><strong>{p.bookingNo}</strong><strong>{inr(p.amount)}</strong></div>
            <p className="sub">{p.guest} · {p.hall}</p>
            <p className="sub">{showDate(p.date)} · {p.mode} · {p.kind === "refund" ? "Refund" : "Paid"}{booking ? ` · Balance ${inr(balanceOf(booking))}` : ""}</p>
            <div className="mapp-actions">
              {booking ? <button type="button" onClick={() => onOpen(booking.id)}>View</button> : null}
              <button type="button" onClick={() => download(`${p.bookingNo}.txt`, invoiceText(booking || { no: p.bookingNo, guest: p.guest, total: p.amount, paid: p.amount, hallId: "imperial", date: p.date }))}>Download Invoice</button>
              <button type="button" onClick={() => shareWhatsApp(`${p.bookingNo} ${p.guest} ${inr(p.amount)} ${p.mode}`)}>WhatsApp</button>
            </div>
          </article>
        );
      })}
      {role === "Owner" ? <button type="button" className="mapp-cta" onClick={() => download("payments.csv", ["Booking,Guest,Hall,Amount,Mode,Date", ...rows.map((p) => `${p.bookingNo},${p.guest},${p.hall},${p.amount},${p.mode},${p.date}`)].join("\n"))}>Export Excel</button> : null}
    </>
  );
}

function Register({ state, role }) {
  return (
    <>
      <h1>Payment Register</h1>
      {state.bookings.filter((b) => b.status !== "Cancelled").slice(0, 12).map((b) => {
        const tax = gstSplit(b.total);
        const refund = state.payments.filter((p) => p.bookingNo === b.no && p.kind === "refund").reduce((n, p) => n + p.amount, 0);
        return (
          <article key={b.id} className="mapp-card">
            <strong>{b.no}</strong>
            <div className="mapp-bill"><span>Amount</span><span>{inr(b.total)}</span></div>
            <div className="mapp-bill"><span>Collected</span><span>{inr(b.paid)}</span></div>
            <div className="mapp-bill"><span>Refund</span><span>{inr(refund)}</span></div>
            <div className="mapp-bill"><span>Balance</span><span>{inr(balanceOf(b))}</span></div>
            {role === "Owner" ? <div className="mapp-bill"><span>GST</span><span>{inr(tax.cgst + tax.sgst)}</span></div> : null}
          </article>
        );
      })}
    </>
  );
}

function ExpenseEntry({ existing, onSave }) {
  const [form, setForm] = useState(existing || { date: TODAY, dept: "Hotel", type: "Diesel", by: "Owner", taken: "", amount: "", mode: "Cash", note: "", file: "" });
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
  const [to, setTo] = useState(TODAY);
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
  const tax = gstSplit(booking.total || 0);
  return [
    "Gayatri Convention",
    booking.no,
    booking.guest,
    hallName(booking.hallId),
    showDate(booking.date),
    `Total ${inr(booking.total)}`,
    `GST ${inr(tax.cgst + tax.sgst)}`,
    `Paid ${inr(booking.paid || 0)}`,
    `Balance ${inr(balanceOf(booking))}`,
  ].join("\n");
}

function Invoice({ booking, role }) {
  const tax = gstSplit(booking.total || 0);
  const text = invoiceText(booking);
  return (
    <>
      <h1>Invoice</h1>
      <section className="mapp-card">
        <strong>{booking.no}</strong>
        <p className="sub">{booking.guest} · {booking.phone}</p>
        <p className="sub">{hallName(booking.hallId)} · {booking.package} · {showDate(booking.date)}</p>
        <div className="mapp-bill"><span>Taxable</span><span>{inr(tax.taxable)}</span></div>
        <div className="mapp-bill"><span>CGST 9%</span><span>{inr(tax.cgst)}</span></div>
        <div className="mapp-bill"><span>SGST 9%</span><span>{inr(tax.sgst)}</span></div>
        <div className="mapp-bill"><strong>Total</strong><strong>{inr(booking.total)}</strong></div>
        <div className="mapp-bill"><span>Advance</span><span>{inr(booking.paid)}</span></div>
        <div className="mapp-bill"><span>Balance</span><span>{inr(balanceOf(booking))}</span></div>
      </section>
      <button type="button" className="mapp-cta" onClick={() => window.print()}>Print Invoice</button>
      {role === "Owner" ? <button type="button" className="mapp-ghost" onClick={() => download(`${booking.no}.txt`, text)}>PDF Download</button> : null}
      {role !== "Receptionist" ? <button type="button" className="mapp-ghost" onClick={() => shareWhatsApp(text)}>WhatsApp Share</button> : null}
    </>
  );
}

const PAGES = [
  ["home", "2 Dashboard"],
  ["reservations", "3 Reservations"],
  ["new", "4 New reservation"],
  ["calendar", "5 Calendar"],
  ["detail", "6 Booking details"],
  ["rooms", "7 Rooms booking"],
  ["room-avail", "8 Room availability"],
  ["pay", "9 Payment & invoice"],
  ["guests", "10 Guests / CRM"],
  ["documents", "11 Documents"],
  ["reports", "12 Report summary"],
  ["today", "13 Today report"],
  ["period", "14 Period report"],
  ["pay-history", "15 Payment history"],
  ["register", "16 Payment register"],
  ["expense", "17 Expense entry"],
  ["expense-list", "18 Expense list"],
];

function More({ state, go, onLogout }) {
  const role = state.user?.role;
  const links = [
    ["guests", "Guests / CRM", true],
    ["documents", "Documents", true],
    ["refunds", "Refunds", true],
    ["expense", role === "Receptionist" ? "Upload bill" : "Add expense", allow(role, "expense.add") || allow(role, "expense.submit")],
    ["register", "Payment register", role !== "Receptionist"],
    ["staff", "Staff", role === "Owner"],
    ["settings", "Settings", role === "Owner"],
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
      <button type="button" className="mapp-line"><span className="mapp-grow"><strong>Help & support</strong><span className="sub">events@gayatrifunctionhall.com</span></span></button>
      {role === "Owner" ? (
        <>
          <h2>All pages</h2>
          {PAGES.map(([id, label]) => (
            <button key={id} type="button" className="mapp-line" onClick={() => go(id)}><span className="mapp-grow">{label}</span></button>
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

function Settings({ state, dispatch, flash }) {
  const [property, setProperty] = useState(state.settings.property);
  const [refundNote, setRefundNote] = useState(state.settings.refundNote);
  return (
    <>
      <h1>Settings</h1>
      <label>Property name<input value={property} onChange={(e) => setProperty(e.target.value)} /></label>
      <label>Refund rule<input value={refundNote} onChange={(e) => setRefundNote(e.target.value)} /></label>
      <button type="button" className="mapp-cta" onClick={() => { commit({ type: "update-settings", settings: { property, refundNote } }); flash("Settings saved on this phone preview."); }}>Save settings</button>
      <section className="mapp-card">
        <strong>Protected rules</strong>
        <p className="sub">Only the owner can add a manager or receptionist, disable a login, approve a refund, and approve an expense.</p>
        <p className="sub">A receptionist cannot delete bookings, delete payments, approve refunds, view net profit, or open settings.</p>
        <p className="sub">A manager cannot view net profit or manage staff. A manager cannot approve their own expense.</p>
      </section>
    </>
  );
}
