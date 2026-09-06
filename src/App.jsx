import { useEffect, useState } from "react";
import Dashboard from "./pages/Dashboard.jsx";
import Calendar from "./pages/Calendar.jsx";
import Venues from "./pages/Venues.jsx";
import Rooms from "./pages/Rooms.jsx";
import Reservations from "./pages/Reservations.jsx";
import Guests from "./pages/Guests.jsx";
import Events from "./pages/Events.jsx";
import Catering from "./pages/Catering.jsx";
import Vendors from "./pages/Vendors.jsx";
import Billing from "./pages/Billing.jsx";
import Reports from "./pages/Reports.jsx";
import Settings from "./pages/Settings.jsx";
import Master from "./pages/Master.jsx";
import Documents from "./pages/Documents.jsx";
import Home from "./pages/Home.jsx";
import Assistant from "./pages/Assistant.jsx";
import { ROLES } from "./seed";
import { coverage } from "./docTypes";
import { bookingFolio } from "./engine";
import { money } from "./lib";
import {
  addCatering,
  addEnquiry,
  addPO,
  addPayment,
  addVendor,
  attachDocument,
  attachMany,
  cancelBooking,
  checkInRoom,
  checkOutRoom,
  clearAllBookings,
  createReservation,
  getState,
  issueDocument,
  removeDocument,
  removeGuest,
  resetDemo,
  publishTermSets,
  saveHall,
  saveRoom,
  saveRoomType,
  removeRoom,
  saveGuest,
  setFolioDiscount,
  setRoomHousekeeping,
  setRoomStatus,
  setTaskStatus,
  setUser,
  transferRoom,
  updateHall,
  updateProperty,
  verifyDocument,
} from "./store";

const GROUPS = [
  {
    label: "Operations",
    items: [
      { id: "home", label: "Home", perm: "dashboard" },
      { id: "desk", label: "Dashboard", perm: "dashboard" },
      { id: "calendar", label: "Calendar", perm: "calendar" },
      { id: "venues", label: "Venues", perm: "venues" },
      { id: "rooms", label: "Rooms", perm: "rooms" },
      { id: "reserve", label: "Reservations", perm: "reservations" },
    ],
  },
  {
    label: "Guest & event",
    items: [
      { id: "guests", label: "Guests / CRM", perm: "guests" },
      { id: "documents", label: "Documents", perm: "documents" },
      { id: "events", label: "Events", perm: "events" },
      { id: "vendors", label: "Vendors", perm: "vendors" },
    ],
  },
  {
    label: "Finance",
    items: [
      { id: "billing", label: "Payment & Invoice", perm: "billing" },
      { id: "reports", label: "Reports", perm: "reports" },
    ],
  },
  {
    label: "System",
    items: [
      { id: "assistant", label: "Assistant", perm: "dashboard" },
      { id: "settings", label: "Settings", perm: "settings.property" },
      { id: "master", label: "Master data", perm: "settings.property" },
    ],
  },
];

function can(role, perm) {
  const list = ROLES[role]?.permissions || [];
  return list.includes("*") || list.includes(perm);
}

export default function App() {
  const [state, setState] = useState(getState);
  const [page, setPage] = useState("home");
  const [presetDate, setPresetDate] = useState("");
  const [presetGuestId, setPresetGuestId] = useState("");
  const [focusGuestId, setFocusGuestId] = useState("");
  const [bookingId, setBookingId] = useState(null);
  const [navStack, setNavStack] = useState([]);

  useEffect(() => {
    if (page === "home" || page === "portal" || page === "master" || page === "events") {
      setState(getState());
    }
  }, [page]);

  const user = state.users.find((u) => u.id === state.session.userId) || state.users[0];
  const role = user.role;

  function go(id, extra = {}) {
    const drilling = Boolean(extra.bookingId) && (id === "billing" || id === "documents");
    if (drilling) {
      setNavStack((s) => [
        ...s,
        {
          page,
          bookingId,
          guestId: extra.fromGuestId || focusGuestId || presetGuestId,
          date: presetDate,
        },
      ]);
    } else {
      setNavStack([]);
    }
    if (extra.date) setPresetDate(extra.date);
    else if (!drilling) setPresetDate("");
    if (extra.guestId) setPresetGuestId(extra.guestId);
    else if (!drilling) setPresetGuestId("");
    if (extra.guestId && id === "guests") setFocusGuestId(extra.guestId);
    else if (!drilling) setFocusGuestId("");
    if (extra.bookingId) setBookingId(extra.bookingId);
    else setBookingId(null);
    if (id === "home" || id === "portal") {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#home`);
    }
    setPage(id);
  }

  async function handleClearAllBookings() {
    if (
      !window.confirm(
        "Clear ALL bookings, guests, payments, invoices and uploaded documents?\n\nMaster data (halls, rooms, rates) is kept. Dashboard, Calendar and Documents will be empty."
      )
    ) {
      return;
    }
    const next = await clearAllBookings();
    setState(next);
    setBookingId(null);
    setPresetDate("");
    setPresetGuestId("");
    setFocusGuestId("");
    setNavStack([]);
    window.alert(
      "Clean start complete.\n\nAll bookings, guests, payments, bills, document vault files and calendar entries are cleared."
    );
    setPage("desk");
    window.location.reload();
  }

  function goBack() {
    const prev = navStack[navStack.length - 1];
    setNavStack((s) => s.slice(0, -1));
    if (!prev) {
      setBookingId(null);
      return;
    }
    setPresetGuestId("");
    setFocusGuestId(prev.page === "guests" ? prev.guestId || "" : "");
    setPresetDate(prev.date || "");
    setBookingId(prev.bookingId || null);
    setPage(prev.page);
  }

  const titles = {
    desk: "Dashboard",
    calendar: "Calendar",
    venues: "Venues",
    rooms: "Rooms",
    reserve: "Reservations",
    documents: "Documents",
    guests: "CRM",
    events: "Events",
    catering: "Catering",
    vendors: "Vendors",
    billing: "Payment & Invoice",
    reports: "Reports",
    settings: "Settings",
    master: "Master data",
    portal: "Guest portal",
    assistant: "Assistant",
  };

  if (page === "home" || page === "portal") {
    return (
      <Home
        key="public-home"
        state={state}
        onStaff={() => setPage("desk")}
        onEnquire={(form) => {
          const out = addEnquiry(form);
          if (out.state) setState(out.state);
          return out;
        }}
      />
    );
  }

  return (
    <div className="shell">
      <aside className="nav no-print">
        <div className="brand">
          <img className="brand-logo" src="/site/images/logo-gold.png" alt="" />
          <h1>{state.property.brandName || "Gayatri"}</h1>
        </div>
        {GROUPS.map((g) => (
          <div className="nav-group" key={g.label}>
            <span>{g.label}</span>
            {g.items
              .filter((i) => can(role, i.perm))
              .map((i) => (
                <button key={i.id} className={page === i.id ? "on" : ""} onClick={() => go(i.id)}>
                  {i.label}
                </button>
              ))}
          </div>
        ))}
        <div className="nav-foot">
          Signed in
          <select
            value={user.id}
            onChange={(e) => {
              setState(setUser(e.target.value));
              setPage("desk");
            }}
          >
            {state.users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} · {u.role}
              </option>
            ))}
          </select>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar no-print">
          <div>
            <div className="crumb">
              {state.company.group} / {state.property.name}
            </div>
            <h2>{titles[page]}</h2>
          </div>
          <div className="row">
            <span className="muted">{state.notifications[0]?.title}</span>
            <button className="btn ghost small" onClick={() => go("home")}>
              Public site
            </button>
          </div>
        </header>
        <div className="content">
          {page === "desk" && <Dashboard state={state} go={go} onClearBookings={handleClearAllBookings} />}
          {page === "calendar" && (
            <Calendar key={presetDate || "calendar-today"} state={state} go={go} focusDate={presetDate} />
          )}
          {page === "venues" && <Venues state={state} onHall={(id, patch) => setState(updateHall(id, patch))} />}
          {page === "rooms" && (
            <Rooms
              state={state}
              onRoomType={(t) => {
                const out = saveRoomType(t);
                if (out?.error) return out;
                setState(out);
                return out;
              }}
              onRoom={(r) => {
                const out = saveRoom(r);
                if (out?.error) return out;
                setState(out);
                return out;
              }}
              onRemoveRoom={(id) => {
                const out = removeRoom(id);
                if (out?.error) return out;
                setState(out);
                return out;
              }}
              onStatus={(id, s) => setState(setRoomStatus(id, s))}
              onHousekeeping={(id, s) => setState(setRoomHousekeeping(id, s))}
              onCheckIn={(id) => {
                const stay = state.roomReservations.find((s) => s.id === id);
                const cov = stay ? coverage(state, stay.bookingId) : { ok: true };
                if (!cov.ok && !window.confirm("Required hotel documents are missing. Check in anyway?")) return;
                setState(checkInRoom(id));
              }}
              onCheckOut={(id) => setState(checkOutRoom(id))}
              onTransfer={(id, room) => {
                const out = transferRoom(id, room);
                if (out.state) setState(out.state);
                return out;
              }}
              go={go}
            />
          )}
          {page === "reserve" && (
            <Reservations
              key={`${presetGuestId || "reserve"}-${presetDate || "today"}`}
              state={state}
              presetDate={presetDate}
              presetGuest={state.guests.find((g) => g.id === presetGuestId)}
              onSave={async (draft) => {
                const out = createReservation(draft);
                if (out.error) return out;
                if (draft.pendingDocs?.length) {
                  const docs = await attachMany(out.booking.id, out.booking.guestId, draft.pendingDocs);
                  if (docs.error) window.alert(docs.error);
                }
                setState(getState());
                go("billing", { bookingId: out.booking.id });
                return out;
              }}
              onDocs={(id) => go("documents", { bookingId: id })}
              onCancel={(id) => {
                const bk = state.bookings.find((b) => b.id === id);
                if (!bk || bk.status === "Cancelled") return;
                const { totals } = bookingFolio(state, id);
                const m = (n) => money(n, state.property.currency, state.property.locale);
                if (
                  !window.confirm(
                    `Cancel booking ${bk.number}?\n\nThe record is kept under Reports → Cancellations. Calendar and room holds are released.${
                      totals.paid > 0 ? `\n\nAmount collected: ${m(totals.paid)}` : ""
                    }`
                  )
                ) {
                  return;
                }
                let refund = 0;
                if (totals.paid > 0 && window.confirm(`Record a refund of ${m(totals.paid)}?`)) {
                  refund = totals.paid;
                }
                setState(cancelBooking(id, refund));
              }}
              onOpen={(id) => go("billing", { bookingId: id })}
              go={go}
            />
          )}
          {page === "guests" && (
            <Guests
              key={focusGuestId || "guests"}
              state={state}
              go={go}
              focusId={focusGuestId}
              onSave={(g) => {
                const out = saveGuest(g);
                setState(out.state);
                return out;
              }}
              onRemove={(id) => setState(removeGuest(id))}
            />
          )}
          {page === "documents" && (
            <Documents
              key={bookingId || "docs"}
              state={state}
              focusId={bookingId}
              onBack={navStack.length ? goBack : undefined}
              onAttach={async (payload) => {
                const out = await attachDocument(payload);
                if (out.state) setState(out.state);
                return out;
              }}
              onRemove={async (id) => setState(await removeDocument(id))}
              onVerify={(id, v) => setState(verifyDocument(id, v))}
            />
          )}
          {page === "events" && <Events state={state} onTask={(e, t, s) => setState(setTaskStatus(e, t, s))} />}
          {page === "catering" && <Catering state={state} onAdd={(o) => setState(addCatering(o))} />}
          {page === "vendors" && (
            <Vendors
              state={state}
              onVendor={(v) => setState(addVendor(v))}
              onPO={(p) => setState(addPO(p))}
            />
          )}
          {page === "billing" && (
            <Billing
              key={bookingId || "list"}
              state={state}
              focusId={bookingId}
              backLabel={navStack.length ? "Back" : "All payments"}
              onBack={goBack}
              onClose={() => setBookingId(null)}
              onPay={(id, p) => setState(addPayment(id, p))}
              onDiscount={(id, d) => setState(setFolioDiscount(id, d))}
              onIssue={(id, t) => {
                const out = issueDocument(id, t);
                setState(out.state);
              }}
              onDocs={(id) => go("documents", { bookingId: id })}
            />
          )}
          {page === "reports" && <Reports state={state} go={go} />}
          {page === "assistant" && <Assistant state={state} />}
          {page === "master" && (
            <Master
              state={state}
              onRefresh={() => setState(getState())}
              onProperty={(p) => setState(updateProperty(p))}
              onHall={(h) => setState(saveHall(h))}
              onRoomType={(t) => {
                const out = saveRoomType(t);
                if (out?.error) return out;
                setState(out);
                return out;
              }}
              onRoom={(r) => {
                const out = saveRoom(r);
                if (out?.error) return out;
                setState(out);
                return out;
              }}
              onRemoveRoom={(id) => {
                const out = removeRoom(id);
                if (out?.error) return out;
                setState(out);
                return out;
              }}
            />
          )}
          {page === "settings" && (
            <Settings
              state={state}
              onProperty={(p) => setState(updateProperty(p))}
              onPublishTerms={(sections) => setState(publishTermSets(sections))}
              onUser={() => {}}
              onReset={() => {
                if (window.confirm("Reload the Palagummi demo property? Current local data will be replaced.")) {
                  setState(resetDemo());
                }
              }}
              onClearBookings={handleClearAllBookings}
            />
          )}
        </div>
      </div>
    </div>
  );
}
