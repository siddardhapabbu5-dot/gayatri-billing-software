import { Suspense, lazy, useEffect, useState } from "react";
import Home from "./pages/Home.jsx";
import StaffLogin from "./pages/StaffLogin.jsx";
import InstallPrompt from "./components/InstallPrompt.jsx";
import InstallAppButton from "./components/InstallAppButton.jsx";
import { initPwaInstallCapture } from "./lib/pwaInstall.js";
import { enableStaffAppMode, syncAppModeFromUrl } from "./lib/appMode.js";
import { ROLES } from "./seed";
import { coverage } from "./docTypes";
import { bookingFolio } from "./engine";
import { money } from "./lib";
import { KEY } from "./lib";
import { clearAuth, getAuthUser, getToken } from "./api/client";
import {
  addCatering,
  addEnquiry,
  addPO,
  addPayment,
  addVendor,
  attachDocument,
  attachMany,
  cancelBooking,
  cancelRoomStay,
  checkInRoom,
  checkOutRoom,
  clearAllBookings,
  createReservation,
  getState,
  issueDocument,
  loadDeskCaseBookings,
  processCancellation,
  processRefund,
  approveRefund,
  reversePayment,
  removeDocument,
  removeGuest,
  resetDemo,
  publishTermSets,
  saveHall,
  saveRoom,
  saveRoomType,
  removeRoom,
  saveGuest,
  setBookingCancelReason,
  setFolioDiscount,
  setFolioGstMode,
  setRoomHousekeeping,
  setRoomStatus,
  transferRoom,
  updateHall,
  updateProperty,
  verifyDocument,
  addExpense,
  removeExpense,
  updateExpense,
  attachExpenseReceipt,
  setExpenseVerified,
  addFolioCharge,
} from "./store";

const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));
const Calendar = lazy(() => import("./pages/Calendar.jsx"));
const Venues = lazy(() => import("./pages/Venues.jsx"));
const Rooms = lazy(() => import("./pages/Rooms.jsx"));
const Reservations = lazy(() => import("./pages/Reservations.jsx"));
const Guests = lazy(() => import("./pages/Guests.jsx"));
const Catering = lazy(() => import("./pages/Catering.jsx"));
const Vendors = lazy(() => import("./pages/Vendors.jsx"));
const Billing = lazy(() => import("./pages/Billing.jsx"));
const Reports = lazy(() => import("./pages/Reports.jsx"));
const Expenses = lazy(() => import("./pages/Expenses.jsx"));
const Settings = lazy(() => import("./pages/Settings.jsx"));
const Master = lazy(() => import("./pages/Master.jsx"));
const Documents = lazy(() => import("./pages/Documents.jsx"));
const Assistant = lazy(() => import("./pages/Assistant.jsx"));

function StaffPageFallback() {
  return (
    <div className="page" style={{ padding: "2rem 1.25rem" }}>
      <p className="muted" style={{ margin: 0 }}>
        Loading…
      </p>
    </div>
  );
}

function applyAuthUser(authUser) {
  const state = getState();
  const existing = state.users.find((u) => u.email?.toLowerCase() === authUser.email?.toLowerCase());
  const id = existing?.id || authUser.id;
  if (!existing) {
    state.users = [
      ...state.users,
      { id, name: authUser.name, role: authUser.role, email: authUser.email },
    ];
  } else {
    existing.name = authUser.name;
    existing.role = authUser.role;
  }
  state.session = { ...state.session, userId: id, auth: true };
  localStorage.setItem(KEY, JSON.stringify(state));
  return getState();
}

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
      { id: "vendors", label: "Vendors", perm: "vendors" },
    ],
  },
  {
    label: "Finance",
    items: [
      { id: "billing", label: "Payment & Invoice", perm: "billing" },
      { id: "expenses", label: "Expense entry", perm: "expenses" },
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

function permForPage(pageId) {
  for (const g of GROUPS) {
    const hit = g.items.find((i) => i.id === pageId);
    if (hit) return hit.perm;
  }
  return "dashboard";
}

/** First staff page this role is allowed to open (Housekeeping has no Dashboard). */
function homeStaffPage(role) {
  const r = String(role || "").toLowerCase();
  const preferred = ["desk", "rooms", "calendar", "reserve", "billing", "reports"];
  for (const id of preferred) {
    if (can(r, permForPage(id))) return id;
  }
  for (const g of GROUPS) {
    for (const i of g.items) {
      if (i.id === "home" || i.id === "portal") continue;
      if (can(r, i.perm)) return i.id;
    }
  }
  return "rooms";
}

const STAFF_PAGES = new Set(
  GROUPS.flatMap((g) => g.items.map((i) => i.id)).filter((id) => id !== "home" && id !== "portal")
);

/** Public website section hashes (#venues, #rooms, …) — must not open staff desk. */
const PUBLIC_SITE_HASHES = new Set([
  "home",
  "about",
  "venues",
  "stay",
  "stay-space",
  "rooms",
  "gallery",
  "booking",
  "contact",
  "terms",
  "staff",
]);

function staffHref(id) {
  if (id === "home" || id === "portal") return `${window.location.pathname}${window.location.search}#home`;
  return `${window.location.pathname}${window.location.search}#staff/${id}`;
}

const NAV_MIN_KEY = "gayatri-staff-nav-min";

function readNavMin() {
  try {
    return localStorage.getItem(NAV_MIN_KEY) === "1";
  } catch {
    return false;
  }
}

function pageFromHash() {
  const full = String(window.location.hash || "").replace(/^#/, "");
  if (!full || full === "home") return "home";
  if (full === "portal") return "portal";
  if (full.startsWith("staff/")) {
    const id = full.slice(6).split(/[/?#]/)[0];
    if (id === "login") return "login";
    if (STAFF_PAGES.has(id)) return id;
    return "desk";
  }
  const raw = full.split(/[/?]/)[0];
  // Logged-in refresh on #venues used to jump into staff Venues — keep public hashes on the website.
  if (PUBLIC_SITE_HASHES.has(raw)) return "home";
  if (STAFF_PAGES.has(raw)) return raw;
  return null;
}

export default function App() {
  const [state, setState] = useState(getState);
  const [page, setPage] = useState(() => {
    const fromHash = pageFromHash();
    if (fromHash === "login") return "home";
    if (fromHash && fromHash !== "home" && fromHash !== "portal" && getToken() && getAuthUser()) {
      return fromHash;
    }
    if (fromHash === "home" || fromHash === "portal") return fromHash;
    return "home";
  });
  const [presetDate, setPresetDate] = useState("");
  const [presetGuestId, setPresetGuestId] = useState("");
  const [focusGuestId, setFocusGuestId] = useState("");
  const [bookingId, setBookingId] = useState(null);
  const [navStack, setNavStack] = useState([]);
  const [authUser, setAuthUser] = useState(() => (getToken() ? getAuthUser() : null));
  const [staffGate, setStaffGate] = useState(() => {
    const fromHash = pageFromHash();
    if (fromHash === "login") return true;
    return Boolean(fromHash && fromHash !== "home" && fromHash !== "portal" && !(getToken() && getAuthUser()));
  });
  const [pendingStaffPage, setPendingStaffPage] = useState(() => {
    const fromHash = pageFromHash();
    if (fromHash === "login") return "desk";
    return fromHash && fromHash !== "home" && fromHash !== "portal" ? fromHash : "desk";
  });
  const [navMin, setNavMin] = useState(readNavMin);

  function toggleNavMin() {
    setNavMin((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(NAV_MIN_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  useEffect(() => {
    syncAppModeFromUrl();
    initPwaInstallCapture();
  }, []);

  useEffect(() => {
    // Always reload desk data from localStorage when opening staff pages
    // so Dashboard / Reports / Billing pick up expenses, payments and samples.
    if (page !== "home" && page !== "portal") {
      setState(getState());
    }
  }, [page]);

  useEffect(() => {
    if (authUser) setState(applyAuthUser(authUser));
  }, [authUser]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("clearAll") !== "1") return;
    params.delete("clearAll");
    const qs = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash || ""}`);
    void handleClearAllBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot URL clear
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("loadDesk") !== "1") return;
    params.delete("loadDesk");
    const qs = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash || ""}`);
    const out = loadDeskCaseBookings();
    if (out?.error) {
      window.alert(out.error);
      return;
    }
    setState(getState());
    window.alert("Loaded desk cases: Sriram, Siddhu, Siddardha (with payment + refund history).");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot URL load
  }, []);

  useEffect(() => {
    function applyHash() {
      const next = pageFromHash();
      if (!next) return;
      if (next === "login") {
        enableStaffAppMode();
        if (!(getToken() && getAuthUser())) {
          setPendingStaffPage("desk");
          setStaffGate(true);
        }
        return;
      }
      if (next === "home" || next === "portal") {
        setStaffGate(false);
        setPage(next);
        syncAppModeFromUrl();
        return;
      }
      if (!getToken() || !getAuthUser()) {
        enableStaffAppMode();
        setPendingStaffPage(next);
        setStaffGate(true);
        return;
      }
      enableStaffAppMode();
      setAuthUser(getAuthUser());
      setStaffGate(false);
      setPage(next);
    }
    window.addEventListener("hashchange", applyHash);
    window.addEventListener("popstate", applyHash);
    return () => {
      window.removeEventListener("hashchange", applyHash);
      window.removeEventListener("popstate", applyHash);
    };
  }, []);

  // Leave public-site CSS mode before painting staff login (avoids blank/cream screen).
  useEffect(() => {
    if (!(staffGate && !authUser)) return undefined;
    document.documentElement.classList.remove("lux-page");
    document.body.classList.remove("menu-lock");
    document.body.style.overflow = "";
    return undefined;
  }, [staffGate, authUser]);

  const user = state.users.find((u) => u.id === state.session.userId) || state.users[0];
  const role = String(authUser?.role || user.role || "").toLowerCase();

  // Block deep-links to pages this role cannot open (menu alone is not enough).
  useEffect(() => {
    if (!authUser) return;
    if (page === "home" || page === "portal") return;
    const need = permForPage(page);
    if (!can(role, need)) {
      go(homeStaffPage(role));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- guard on page/role only
  }, [authUser, page, role]);

  function enterStaff() {
    enableStaffAppMode();
    if (getToken() && getAuthUser()) {
      const u = getAuthUser();
      setAuthUser(u);
      setStaffGate(false);
      go(homeStaffPage(u.role));
      return;
    }
    document.documentElement.classList.remove("lux-page");
    document.body.classList.remove("menu-lock");
    document.body.style.overflow = "";
    setPendingStaffPage("desk");
    setStaffGate(true);
    const loginHash = `${window.location.pathname}${window.location.search}#staff/login`;
    if (window.location.hash !== "#staff/login") {
      window.history.pushState(null, "", loginHash);
    }
  }

  function logoutStaff() {
    clearAuth();
    setAuthUser(null);
    setStaffGate(false);
    go("home");
  }

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
    const href = staffHref(id);
    const nextHash = href.includes("#") ? `#${href.split("#")[1]}` : "";
    if (window.location.hash !== nextHash) {
      window.history.pushState(null, "", href);
    }
    setPage(id);
  }

  function openNav(e, id) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return;
    e.preventDefault();
    go(id);
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
    go("desk");
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
    catering: "Catering",
    vendors: "Vendors",
    billing: "Payment & Invoice",
    expenses: "Expense entry",
    reports: "Reports",
    settings: "Settings",
    master: "Master data",
    portal: "Guest portal",
    assistant: "Assistant",
  };

  if (staffGate && !authUser) {
    return (
      <>
        <InstallPrompt />
        <StaffLogin
          onBack={() => {
            setStaffGate(false);
            go("home");
          }}
          onSuccess={(u) => {
            enableStaffAppMode();
            setAuthUser(u);
            setStaffGate(false);
            setState(applyAuthUser(u));
            const want = pendingStaffPage || "desk";
            const dest = can(u.role, permForPage(want)) ? want : homeStaffPage(u.role);
            go(dest);
          }}
        />
      </>
    );
  }

  if (page === "home" || page === "portal") {
    return (
      <>
        <InstallPrompt />
        <Home
          key="public-home"
          state={state}
          onStaff={enterStaff}
          onEnquire={(form) => {
            const out = addEnquiry(form);
            if (out.state) setState(out.state);
            return out;
          }}
        />
      </>
    );
  }

  if (!authUser) {
    return (
      <>
        <InstallPrompt />
        <StaffLogin
          onBack={() => go("home")}
          onSuccess={(u) => {
            enableStaffAppMode();
            setAuthUser(u);
            setState(applyAuthUser(u));
            const want = pendingStaffPage || "desk";
            const dest = can(u.role, permForPage(want)) ? want : homeStaffPage(u.role);
            go(dest);
          }}
        />
      </>
    );
  }

  return (
    <>
    <InstallPrompt />
    <div className={`shell${navMin ? " is-nav-min" : ""}`}>
      <aside className={`nav no-print${navMin ? " is-min" : ""}`} aria-label="Staff menu">
        <div className="brand">
          <img className="brand-logo" src="/site/images/logo-gold.png" alt="" />
          <h1>{state.property.brandName || "Gayatri"}</h1>
          <button
            type="button"
            className="nav-min-btn"
            onClick={toggleNavMin}
            aria-expanded={!navMin}
            title={navMin ? "Expand menu" : "Minimize menu"}
          >
            {navMin ? "»" : "« Minimize"}
          </button>
        </div>
        <div className="nav-scroll">
          {GROUPS.map((g) => (
            <div className="nav-group" key={g.label}>
              <span>{g.label}</span>
              {g.items
                .filter((i) => can(role, i.perm))
                .map((i) => (
                  <a
                    key={i.id}
                    href={staffHref(i.id)}
                    className={page === i.id ? "on" : ""}
                    title={i.label}
                    onClick={(e) => openNav(e, i.id)}
                  >
                    <span className="nav-label-full">{i.label}</span>
                    <span className="nav-label-short" aria-hidden="true">
                      {i.label
                        .split(/[\s/&]+/)
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((w) => w[0])
                        .join("")
                        .toUpperCase()}
                    </span>
                  </a>
                ))}
            </div>
          ))}
        </div>
        <div className="nav-foot">
          <div className="nav-foot-user">
            {authUser.name}
            <div className="muted">{authUser.roleLabel || authUser.role}</div>
          </div>
          <button className="btn ghost small nav-logout" type="button" onClick={logoutStaff}>
            Logout
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar no-print">
          <div className="topbar-lead">
            {navMin && (
              <button
                type="button"
                className="btn ghost small nav-expand-btn"
                onClick={toggleNavMin}
                title="Expand menu"
              >
                ☰ Menu
              </button>
            )}
            <div>
              <div className="crumb">
                {state.company.group} / {state.property.name}
              </div>
              <h2>{titles[page]}</h2>
            </div>
          </div>
          <div className="row">
            <span className="muted">{state.notifications[0]?.title}</span>
            <InstallAppButton tone="dark" />
            <a className="btn ghost small" href={staffHref("home")} onClick={(e) => openNav(e, "home")}>
              Public site
            </a>
            <button className="btn ghost small" type="button" onClick={logoutStaff}>
              Logout
            </button>
          </div>
        </header>
        <div className="content">
          <Suspense fallback={<StaffPageFallback />}>
            {page === "desk" && (
              <Dashboard
                key={`desk-${(state.payments || []).length}-${(state.expenses || []).length}-${(state.bookings || []).length}`}
                state={state}
                go={go}
              />
            )}
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
                  try {
                    sessionStorage.setItem("gayatri-open-cancel", id);
                  } catch {
                    /* ignore */
                  }
                  go("billing", { bookingId: id });
                }}
                onEditCancelReason={(id, reason) => {
                  setState(setBookingCancelReason(id, reason));
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
                onGstMode={(id, mode) => {
                  const out = setFolioGstMode(id, mode);
                  if (out?.error) return out;
                  setState(out);
                  return out;
                }}
                onCharge={(id, payload) => {
                  const out = addFolioCharge(id, payload);
                  if (out?.error) return out;
                  setState(out);
                  return out;
                }}
                onCancelBooking={(id, payload) => {
                  const out = processCancellation(id, payload);
                  if (out?.error) {
                    window.alert(out.error);
                    return out;
                  }
                  setState(out.state || getState());
                  if (out.pendingApproval) window.alert("Refund is pending manager approval.");
                  return out;
                }}
                onProcessRefund={(id, payload) => {
                  const out = processRefund(id, payload);
                  if (out?.error) {
                    window.alert(out.error);
                    return out;
                  }
                  setState(out.state || getState());
                  if (out.pendingApproval) window.alert("Refund is pending manager approval.");
                  return out;
                }}
                onReversePayment={(paymentId, reason) => {
                  const out = reversePayment(paymentId, reason);
                  if (out?.error) {
                    window.alert(out.error);
                    return;
                  }
                  setState(out);
                }}
                onApproveRefund={(id) => {
                  const out = approveRefund(id, { note: "Approved" });
                  if (out?.error) {
                    window.alert(out.error);
                    return;
                  }
                  setState(out);
                }}
                onRejectRefund={(id) => {
                  const note = window.prompt("Reject reason") || "Rejected";
                  const out = approveRefund(id, { note, reject: true });
                  if (out?.error) {
                    window.alert(out.error);
                    return;
                  }
                  setState(out);
                }}
                onCancelRoom={(resId) => {
                  if (!window.confirm("Cancel this room stay only?\n\nHall booking and payments stay. Room charges drop from the bill. No refund is posted.")) {
                    return;
                  }
                  const out = cancelRoomStay(resId);
                  if (out?.error) {
                    window.alert(out.error);
                    return;
                  }
                  setState(out);
                }}
                onIssue={(id, t) => {
                  const out = issueDocument(id, t);
                  setState(out.state);
                }}
                onDocs={(id) => go("documents", { bookingId: id })}
              />
            )}
            {page === "expenses" && (
              <Expenses
                state={state}
                onAdd={(payload) => {
                  const out = addExpense(payload);
                  if (out?.error) return out;
                  setState(out);
                  return out;
                }}
                onUpdate={(id, payload) => {
                  const out = updateExpense(id, payload);
                  if (out?.error) return out;
                  setState(out);
                  return out;
                }}
                onRemove={async (id) => {
                  const out = await removeExpense(id);
                  setState(out);
                }}
                onAttachReceipt={async (id, file) => {
                  const out = await attachExpenseReceipt(id, file);
                  if (out?.error) return out;
                  setState(out);
                  return out;
                }}
                onVerify={(id, verified) => {
                  const out = setExpenseVerified(id, verified);
                  if (out?.error) return out;
                  setState(out);
                  return out;
                }}
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
                onLoadDeskCases={() => {
                  const out = loadDeskCaseBookings();
                  if (out?.error) {
                    window.alert(out.error);
                    return;
                  }
                  setState(getState());
                  window.alert("Loaded: Sriram, Siddhu, Siddardha.");
                }}
              />
            )}
          </Suspense>
        </div>
      </div>
    </div>
    </>
  );
}
