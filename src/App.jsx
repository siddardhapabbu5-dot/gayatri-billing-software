import { Suspense, lazy, useEffect, useState } from "react";
import Home from "./pages/Home.jsx";
import StaffLogin from "./pages/StaffLogin.jsx";
import InstallAppButton from "./components/InstallAppButton.jsx";
import StaffMobileHeader from "./components/staff-mobile/StaffMobileHeader.jsx";
import StaffMobileDrawer from "./components/staff-mobile/StaffMobileDrawer.jsx";
import StaffMobileBottomNav from "./components/staff-mobile/StaffMobileBottomNav.jsx";
import { initPwaInstallCapture } from "./lib/pwaInstall.js";
import {
  enablePublicAppMode,
  enableStaffAppMode,
  isStaffEntryUnsigned,
  isStaffPath,
  migrateStaffHashToPath,
  pageFromStaffPath,
  publicHomeHref,
  redirectLegacyStaffHost,
  STAFF_PATH,
  staffPageHref,
  syncAppModeFromUrl,
} from "./lib/appMode.js";
import { normalizeRole, ROLES } from "./seed";
import { canPerm } from "./lib/permissions.js";
import { coverage } from "./docTypes";
import { bookingFolio } from "./engine";
import { money } from "./lib";
import { KEY } from "./lib";
import { clearAuth, getAuthUser, getToken } from "./api/client";
import { hydrateDeskFromServer } from "./serverSync.js";
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
  createReservation,
  getState,
  issueDocument,
  processCancellation,
  processRefund,
  approveRefund,
  reversePayment,
  removeDocument,
  removeGuest,
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
const UserManagement = lazy(() => import("./pages/UserManagement.jsx"));
const RolesPermissions = lazy(() => import("./pages/RolesPermissions.jsx"));
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

function applyAuthUser(authUser, incoming) {
  const state = incoming || getState();
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
    icon: "⚙",
    items: [
      { id: "desk", label: "Dashboard", perm: "dashboard" },
      { id: "calendar", label: "Calendar", perm: "calendar" },
      { id: "venues", label: "Venues", perm: "venues" },
      { id: "rooms", label: "Rooms", perm: "rooms" },
      { id: "reserve", label: "Reservations", perm: "reservations" },
    ],
  },
  {
    label: "Guest & event",
    icon: "👥",
    items: [
      { id: "guests", label: "Guests / CRM", perm: "guests" },
      { id: "documents", label: "Documents", perm: "documents" },
      { id: "vendors", label: "Vendors", perm: "vendors" },
    ],
  },
  {
    label: "Finance",
    icon: "₹",
    items: [
      { id: "billing", label: "Payment & Invoice", perm: "billing" },
      { id: "expenses", label: "Expense entry", perm: "expenses" },
      { id: "reports", label: "Reports", perm: "reports" },
    ],
  },
  {
    label: "System",
    icon: "🛠",
    items: [
      { id: "assistant", label: "Assistant", perm: "dashboard" },
      { id: "users", label: "User Management", perm: "user.manage" },
      { id: "roles", label: "Roles & Permissions", perm: "users.permissions" },
      { id: "settings", label: "Settings", perm: "settings.property" },
      { id: "master", label: "Master data", perm: "settings.property" },
    ],
  },
];

function can(role, perm, permissionList) {
  const key = normalizeRole(role);
  const fromSeed = ROLES[key]?.permissions || [];
  const list =
    Array.isArray(permissionList) && permissionList.length
      ? permissionList
      : fromSeed;
  return canPerm(list, perm);
}

function permForPage(pageId) {
  for (const g of GROUPS) {
    const hit = g.items.find((i) => i.id === pageId);
    if (hit) return hit.perm;
  }
  return "dashboard";
}

function canOpenPage(role, pageId, permissionList) {
  if (pageId === "users") {
    return (
      can(role, "user.manage", permissionList) ||
      can(role, "user.create.staff", permissionList) ||
      can(role, "user.create.any", permissionList)
    );
  }
  if (pageId === "roles") {
    return can(role, "users.permissions", permissionList) || normalizeRole(role) === "admin";
  }
  if (pageId === "settings") {
    return can(role, "settings.property", permissionList);
  }
  return can(role, permForPage(pageId), permissionList);
}

/** First staff page this role is allowed to open (Housekeeping has no Dashboard). */
function homeStaffPage(role, permissionList) {
  const r = normalizeRole(role);
  const preferred = ["desk", "rooms", "calendar", "reserve", "billing", "reports"];
  for (const id of preferred) {
    if (canOpenPage(r, id, permissionList)) return id;
  }
  for (const g of GROUPS) {
    for (const i of g.items) {
      if (i.id === "home" || i.id === "portal") continue;
      if (canOpenPage(r, i.id, permissionList)) return i.id;
    }
  }
  return "rooms";
}

function isStaffEntryGate() {
  return isStaffEntryUnsigned();
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

function groupForPage(pageId) {
  for (const g of GROUPS) {
    if (g.items.some((i) => i.id === pageId)) return g.label;
  }
  return GROUPS[0]?.label || "Operations";
}

const NAV_OPEN_KEY = "gayatri-staff-nav-open";

function readNavOpen() {
  try {
    const v = localStorage.getItem(NAV_OPEN_KEY);
    if (v === null) return true;
    return v !== "0";
  } catch {
    return true;
  }
}

function staffHref(id) {
  return staffPageHref(id);
}

function goPublicHome() {
  enablePublicAppMode();
  const href = publicHomeHref();
  const here = `${window.location.pathname}${window.location.search || ""}${window.location.hash || ""}`;
  if (here !== href && here !== "/#home") {
    window.history.pushState(null, "", href);
  }
}

/**
 * Keep the visitor on a clean /staff path for the login gate.
 * Deep links like /staff/calendar are preserved (no rewrite to /staff, no # fragments).
 */
function ensureStaffLoginUrl() {
  migrateStaffHashToPath();
  if (isStaffPath()) return;
  window.history.replaceState(null, "", STAFF_PATH);
}

/**
 * Resolve the current route from pathname (staff) or public hash sections.
 * Legacy #staff/... bookmarks are rewritten to /staff/... first.
 */
function pageFromLocation() {
  migrateStaffHashToPath();

  if (isStaffPath()) {
    const signedIn = Boolean(getToken() && getAuthUser());
    const staffPage = pageFromStaffPath(undefined, { signedIn });
    if (staffPage) {
      if (STAFF_PAGES.has(staffPage) || staffPage === "login" || staffPage === "desk") {
        return staffPage;
      }
    }
    return signedIn ? "desk" : "login";
  }

  const full = String(window.location.hash || "").replace(/^#/, "");
  if (!full || full === "home") return "home";
  if (full === "portal") return "portal";
  const raw = full.split(/[/?]/)[0];
  // Logged-in refresh on #venues must stay on the public website.
  if (PUBLIC_SITE_HASHES.has(raw)) return "home";
  if (STAFF_PAGES.has(raw)) return raw;
  return null;
}

export default function App() {
  const [state, setState] = useState(getState);
  const [page, setPage] = useState(() => {
    const fromLoc = pageFromLocation();
    if (fromLoc === "login") return "home";
    if (fromLoc && fromLoc !== "home" && fromLoc !== "portal" && getToken() && getAuthUser()) {
      return fromLoc;
    }
    if (fromLoc === "home" || fromLoc === "portal") return fromLoc;
    return "home";
  });
  const [presetDate, setPresetDate] = useState("");
  const [presetGuestId, setPresetGuestId] = useState("");
  const [focusGuestId, setFocusGuestId] = useState("");
  const [bookingId, setBookingId] = useState(null);
  const [navStack, setNavStack] = useState([]);
  const [authUser, setAuthUser] = useState(() => (getToken() ? getAuthUser() : null));
  const [staffGate, setStaffGate] = useState(() => {
    if (isStaffEntryGate()) return true;
    const fromLoc = pageFromLocation();
    if (fromLoc === "login") return true;
    return Boolean(fromLoc && fromLoc !== "home" && fromLoc !== "portal" && !(getToken() && getAuthUser()));
  });
  const [pendingStaffPage, setPendingStaffPage] = useState(() => {
    const fromLoc = pageFromLocation();
    if (fromLoc && fromLoc !== "home" && fromLoc !== "portal" && fromLoc !== "login") return fromLoc;
    return "desk";
  });
  const [openNavGroup, setOpenNavGroup] = useState(() => groupForPage(page));
  const [navOpen, setNavOpen] = useState(readNavOpen);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [mobileDrawerGroup, setMobileDrawerGroup] = useState(null);

  function toggleNavOpen() {
    setNavOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(NAV_OPEN_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  function openMobileDrawer() {
    setMobileDrawerOpen(true);
  }

  function closeMobileDrawer() {
    setMobileDrawerOpen(false);
    setMobileDrawerGroup(null);
  }

  function navigateMobile(id) {
    closeMobileDrawer();
    go(id);
  }

  useEffect(() => {
    setOpenNavGroup(groupForPage(page));
  }, [page]);

  useEffect(() => {
    if (!mobileDrawerOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileDrawerOpen]);

  useEffect(() => {
    if (redirectLegacyStaffHost()) return;
    migrateStaffHashToPath();
    syncAppModeFromUrl();
    initPwaInstallCapture();
    // /staff (or legacy app host) → staff email/password login, not the public site.
    if (isStaffEntryGate()) {
      enableStaffAppMode();
      setStaffGate(true);
      const fromLoc = pageFromLocation();
      if (fromLoc && fromLoc !== "login" && fromLoc !== "home" && fromLoc !== "portal") {
        setPendingStaffPage(fromLoc);
      } else {
        setPendingStaffPage("desk");
      }
      ensureStaffLoginUrl();
    }
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
    if (!authUser || !getToken()) return undefined;
    let cancelled = false;
    async function sync() {
      try {
        const next = await hydrateDeskFromServer();
        if (!cancelled) setState(applyAuthUser(authUser, next) || next);
      } catch (err) {
        console.warn("Desk sync failed", err);
      }
    }
    sync();
    const t = window.setInterval(sync, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [authUser]);

  useEffect(() => {
    function applyLocation() {
      const next = pageFromLocation();
      if (!next) return;
      if (next === "login") {
        enableStaffAppMode();
        if (!(getToken() && getAuthUser())) {
          setPendingStaffPage((prev) => {
            const deep = pageFromStaffPath(undefined, { signedIn: false });
            if (deep && deep !== "login" && STAFF_PAGES.has(deep)) return deep;
            return prev || "desk";
          });
          setStaffGate(true);
          ensureStaffLoginUrl();
        } else {
          setStaffGate(false);
          setPage("desk");
          const href = staffHref("desk");
          if (window.location.pathname !== href) {
            window.history.replaceState(null, "", href);
          }
        }
        return;
      }
      if (next === "home" || next === "portal") {
        // On /staff, unsigned visitors stay on staff login (not the marketing site).
        if (isStaffEntryGate()) {
          enableStaffAppMode();
          const deep = pageFromStaffPath(undefined, { signedIn: false });
          setPendingStaffPage(deep && deep !== "login" && STAFF_PAGES.has(deep) ? deep : "desk");
          setStaffGate(true);
          ensureStaffLoginUrl();
          return;
        }
        setStaffGate(false);
        setPage(next);
        syncAppModeFromUrl();
        return;
      }
      if (!getToken() || !getAuthUser()) {
        enableStaffAppMode();
        setPendingStaffPage(next);
        setStaffGate(true);
        ensureStaffLoginUrl();
        return;
      }
      enableStaffAppMode();
      setAuthUser(getAuthUser());
      setStaffGate(false);
      setPage(next);
    }
    window.addEventListener("hashchange", applyLocation);
    window.addEventListener("popstate", applyLocation);
    return () => {
      window.removeEventListener("hashchange", applyLocation);
      window.removeEventListener("popstate", applyLocation);
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
  const role = normalizeRole(authUser?.role || user.role || "");
  const rolePerms = authUser?.permissions;
  const canManageUsers =
    can(role, "user.manage", rolePerms) ||
    can(role, "user.create.staff", rolePerms) ||
    can(role, "user.create.any", rolePerms);
  const canEditRolePermissions = can(role, "users.permissions", rolePerms);

  // Block deep-links to pages this role cannot open (menu alone is not enough).
  useEffect(() => {
    if (!authUser) return;
    if (page === "home" || page === "portal") return;
    if (!canOpenPage(role, page, rolePerms)) {
      go(homeStaffPage(role, rolePerms));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- guard on page/role only
  }, [authUser, page, role]);

  function enterStaff() {
    enableStaffAppMode();
    if (getToken() && getAuthUser()) {
      const u = getAuthUser();
      setAuthUser(u);
      setStaffGate(false);
      go(homeStaffPage(u.role, u.permissions));
      return;
    }
    document.documentElement.classList.remove("lux-page");
    document.body.classList.remove("menu-lock");
    document.body.style.overflow = "";
    setPendingStaffPage("desk");
    setStaffGate(true);
    ensureStaffLoginUrl();
  }

  function logoutStaff() {
    clearAuth();
    setAuthUser(null);
    setBookingId(null);
    setNavStack([]);
    setPendingStaffPage("desk");
    enableStaffAppMode();
    window.history.replaceState(null, "", STAFF_PATH);
    setStaffGate(true);
    setPage("login");
  }

  function go(id, extra = {}) {
    if (id === "home" || id === "portal") {
      setNavStack([]);
      setPresetDate("");
      setPresetGuestId("");
      setFocusGuestId("");
      setBookingId(null);
      setStaffGate(false);
      goPublicHome();
      setPage(id === "portal" ? "portal" : "home");
      return;
    }
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
    const pathNow = String(window.location.pathname || "/").replace(/\/+$/, "") || "/";
    const pathNext = String(href || "/").replace(/\/+$/, "") || "/";
    if (pathNow !== pathNext || window.location.hash) {
      window.history.pushState(null, "", href);
    }
    setPage(id);
  }

  function openNav(e, id) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return;
    e.preventDefault();
    go(id);
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
        <StaffLogin
          lockToDesk={isStaffPath() || isStaffEntryGate()}
          onBack={() => {
            goPublicHome();
            setStaffGate(false);
            setPage("home");
          }}
          onSuccess={(u) => {
            enableStaffAppMode();
            setAuthUser(u);
            setStaffGate(false);
            setState(applyAuthUser(u));
            const want = pendingStaffPage || "desk";
            const dest = canOpenPage(u.role, want, u.permissions)
              ? want
              : homeStaffPage(u.role, u.permissions);
            go(dest);
          }}
        />
      </>
    );
  }

  if (page === "home" || page === "portal") {
    return (
      <>
        <Home
          key="public-home"
          state={state}
          onStaff={enterStaff}
          onEnquire={async (form) => {
            const out = await addEnquiry(form);
            if (out.state) setState(out.state);
            else if (getToken()) {
              try {
                setState(await hydrateDeskFromServer());
              } catch {
                /* ignore */
              }
            }
            return out;
          }}
        />
      </>
    );
  }

  if (!authUser) {
    return (
      <>
        <StaffLogin
          lockToDesk={isStaffPath() || isStaffEntryGate()}
          onBack={() => {
            goPublicHome();
            setPage("home");
          }}
          onSuccess={(u) => {
            enableStaffAppMode();
            setAuthUser(u);
            setState(applyAuthUser(u));
            const want = pendingStaffPage || "desk";
            const dest = canOpenPage(u.role, want, u.permissions)
              ? want
              : homeStaffPage(u.role, u.permissions);
            go(dest);
          }}
        />
      </>
    );
  }

  return (
    <>
    <div
      className={`shell is-staff-phone${navOpen ? "" : " is-nav-closed"}${mobileDrawerOpen ? " is-drawer-open" : ""}`}
    >
      <StaffMobileHeader
        brand={state.property.brandName || "Gayatri"}
        notifyTitle={state.notifications[0]?.title}
        onOpenMenu={openMobileDrawer}
        onProfile={openMobileDrawer}
      />
      <StaffMobileDrawer
        open={mobileDrawerOpen}
        brand={state.property.brandName || "Gayatri"}
        groups={GROUPS.map((g) => ({
          ...g,
          items: g.items.filter((i) => i.id !== "home" && canOpenPage(role, i.id, rolePerms)),
        })).filter((g) => g.items.length)}
        openGroup={mobileDrawerGroup}
        onToggleGroup={(label) => setMobileDrawerGroup((cur) => (cur === label ? null : label))}
        page={page}
        userName={authUser.name}
        userRole={authUser.roleLabel || authUser.role}
        onNavigate={navigateMobile}
        onClose={closeMobileDrawer}
        onLogout={() => {
          closeMobileDrawer();
          logoutStaff();
        }}
        onPublicSite={() => navigateMobile("home")}
      />
      <aside className="nav no-print" aria-hidden={!navOpen}>
        <div className="brand">
          <img className="brand-logo" src="/site/images/logo-gold.png" alt="" />
          <h1>{state.property.brandName || "Gayatri"}</h1>
          <button
            type="button"
            className="nav-collapse-btn"
            onClick={toggleNavOpen}
            title="Close sidebar"
          >
            « Close menu
          </button>
        </div>
        <div className="nav-scroll">
          {GROUPS.map((g) => {
            const items = g.items.filter((i) => canOpenPage(role, i.id, rolePerms));
            if (!items.length) return null;
            const open = openNavGroup === g.label;
            return (
              <div className={`nav-group${open ? " is-open" : ""}`} key={g.label}>
                <button
                  type="button"
                  className="nav-group-toggle"
                  aria-expanded={open}
                  onClick={() => setOpenNavGroup(open ? null : g.label)}
                >
                  <span className="nav-group-label">{g.label}</span>
                  <span className={`nav-group-arrow${open ? " is-open" : ""}`} aria-hidden="true" />
                </button>
                <div className="nav-group-items" hidden={!open}>
                  {items.map((i) => (
                    <a
                      key={i.id}
                      href={staffHref(i.id)}
                      className={page === i.id ? "on" : ""}
                      onClick={(e) => openNav(e, i.id)}
                    >
                      {i.label}
                    </a>
                  ))}
                </div>
              </div>
            );
          })}
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
            {!navOpen && (
              <button
                type="button"
                className="btn ghost small nav-open-btn"
                onClick={toggleNavOpen}
                title="Open sidebar"
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
                staffUser={authUser}
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
                  const out = await createReservation(draft);
                  if (out.error) return out;
                  if (draft.pendingDocs?.length) {
                    const docs = await attachMany(out.booking.id, out.booking.guestId, draft.pendingDocs);
                    if (docs.error) window.alert(docs.error);
                  }
                  setState(out.state || getState());
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
                permissions={rolePerms}
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
                onIssue={async (id, t) => {
                  const out = await issueDocument(id, t);
                  if (out?.error) {
                    window.alert(out.error);
                    return;
                  }
                  setState(out.state);
                }}
                onDocs={(id) => go("documents", { bookingId: id })}
              />
            )}
            {page === "expenses" && (
              <Expenses
                state={state}
                permissions={rolePerms}
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
                authRole={role}
                permissions={rolePerms}
                onProperty={(p) => setState(updateProperty(p))}
                onPublishTerms={(sections) => setState(publishTermSets(sections))}
              />
            )}
            {page === "users" && (
              <UserManagement authRole={role} canManage={canManageUsers} />
            )}
            {page === "roles" && (
              <RolesPermissions canEdit={canEditRolePermissions || role === "admin"} />
            )}
          </Suspense>
        </div>
      </div>
      <StaffMobileBottomNav
        page={page}
        canAccess={(id) => canOpenPage(role, id, rolePerms)}
        onNavigate={(id) => go(id)}
        onMore={openMobileDrawer}
      />
    </div>
    </>
  );
}
