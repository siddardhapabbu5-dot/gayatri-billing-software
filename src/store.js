import { KEY, seqNo, uid, dayToISO, todayISO, addDays } from "./lib";
import { createSeed, defaultRetreatType, defaultRooms, defaultRoomTypes, DEFAULT_ABOUT, DEFAULT_BANQUET, DEFAULT_EVENT_TYPES, DEFAULT_TERMS } from "./seed";
import { DEFAULT_POLICIES, DEFAULT_TERM_SECTIONS, DEFAULT_TERM_SECTIONS_HI, DEFAULT_TERM_SECTIONS_TE, housekeepingOf, occupancyOf, termSetsOf } from "./policies";
import { bookingFolio, folioTotals, hallClash, publicAvailability, roomClash } from "./engine";
import { specById } from "./docTypes";
import { clearBlobs, deleteBlob, putBlob } from "./fileStore";

const WEDDING_EVENT_TYPES = new Set([
  "Wedding",
  "Sangeet / Mehendi",
  "Engagement",
  "Nikaah / Walima",
  "Birthday / Family function",
]);

function rewriteConventionCopy(text) {
  return String(text || "")
    .replace(/Gayatri Function Hall/gi, "Gayatri Convention")
    .replace(/Gayatri Convention Hall/gi, "Gayatri Convention")
    .replace(/Marriage & Function Hall/gi, "Convention")
    .replace(/Function Hall/gi, "Convention")
    .replace(/\bConvention Hall\b/g, "Convention")
    .replace(/\bfunction hall\b/gi, "convention")
    .replace(/\bfunction-hall\b/gi, "convention")
    .replace(/before the function starts/gi, "before the event starts")
    .replace(/\bthe function starts\b/gi, "the event starts");
}

const TERM_BRANDING_FIXES = [
  ["Gayatri Convention Hall", "Gayatri Convention"],
  ["Convention Hall", "Convention"],
  ["Gayatri may refuse", "Gayatri Convention may refuse"],
  ["Gayatri is not responsible", "Gayatri Convention is not responsible"],
  ["గాయత్రి కన్వెన్షన్ హాల్", "గాయత్రి కన్వెన్షన్"],
  ["గాయత్రి తిరస్కరించ", "గాయత్రి కన్వెన్షన్ తిరస్కరించ"],
  ["గాయత్రి బాధ్యత వహించదు", "గాయత్రి కన్వెన్షన్ బాధ్యత వహించదు"],
  ["गायत्री कन्वेंशन हॉल", "गायत्री कन्वेंशन"],
  ["गायत्री मना कर", "गायत्री कन्वेंशन मना कर"],
  ["गायत्री जिम्मेदार नहीं", "गायत्री कन्वेंशन जिम्मेदार नहीं"],
];

function patchTermBrandingText(text) {
  let out = String(text || "");
  TERM_BRANDING_FIXES.forEach(([from, to]) => {
    out = out.split(from).join(to);
  });
  return rewriteConventionCopy(out);
}

/** Runs on every load so saved data and print/PDF always match current branding defaults. */
function normalizePropertyLive(p) {
  if (!p) return false;
  let dirty = false;
  if (/Gayatri Convention Hall/i.test(p.name || "")) {
    p.name = "Gayatri Convention";
    dirty = true;
  }
  if (p.tagline === "Convention Hall") {
    p.tagline = "Convention";
    dirty = true;
  }
  if (!Array.isArray(p.eventTypes) || !p.eventTypes.length) {
    p.eventTypes = [...DEFAULT_EVENT_TYPES];
    dirty = true;
  }
  const about = rewriteConventionCopy(p.about || "");
  if (about !== p.about) {
    p.about = about;
    dirty = true;
  }
  const banquet = rewriteConventionCopy(p.banquetIntro || "");
  if (banquet !== p.banquetIntro) {
    p.banquetIntro = banquet;
    dirty = true;
  }
  if (p.terms && /Convention Hall|Gayatri Convention Hall/i.test(p.terms)) {
    const next = patchTermBrandingText(p.terms);
    if (next !== p.terms) {
      p.terms = next;
      dirty = true;
    }
  }
  const ts = p.termSets;
  if (ts) {
    const blob = JSON.stringify(ts);
    if (/Gayatri Convention Hall|Convention Hall/.test(blob)) {
      if (ts.sections) {
        ts.sections = Object.fromEntries(
          Object.entries(ts.sections).map(([k, v]) => [k, patchTermBrandingText(v)])
        );
      }
      if (ts.locales) {
        ts.locales = Object.fromEntries(
          Object.entries(ts.locales).map(([lang, sections]) => [
            lang,
            Object.fromEntries(Object.entries(sections || {}).map(([k, v]) => [k, patchTermBrandingText(v)])),
          ])
        );
      }
      dirty = true;
    }
  }
  return dirty;
}

function applyConventionHallRebrand(state) {
  const p = state.property;
  if (p) {
    if (!p.name || /function hall|marriage|convention hall/i.test(p.name)) p.name = "Gayatri Convention";
    if (!p.tagline || /marriage|function hall|convention hall/i.test(p.tagline)) p.tagline = "Convention";
    if (!p.about || /wedding|marriage|welcome parties/i.test(p.about)) p.about = DEFAULT_ABOUT;
    if (!p.banquetIntro || /wedding|reception|family function/i.test(p.banquetIntro)) p.banquetIntro = DEFAULT_BANQUET;
    const types = p.eventTypes || [];
    if (!types.length || types.some((t) => WEDDING_EVENT_TYPES.has(t))) {
      p.eventTypes = [...DEFAULT_EVENT_TYPES];
    }
    if (p.termSets?.sections) {
      p.termSets.sections = Object.fromEntries(
        Object.entries(p.termSets.sections).map(([k, v]) => [k, rewriteConventionCopy(v)])
      );
    }
    if (p.terms) p.terms = rewriteConventionCopy(p.terms);
  }
  state.halls = (state.halls || []).map((h) => {
    const blob = `${h.tag || ""} ${h.jp || ""} ${h.copy || ""} ${(h.seating || []).join(" ")}`;
    if (!/mandap|phera|nikaah|mehendi|wedding|reception|intimate functions/i.test(blob)) return h;
    if (h.id === "hall-1") {
      return {
        ...h,
        tag: "Plenary sessions. Stage, crystal light.",
        jp: "Plenary sessions",
        copy: "A double-height hall for conferences and exhibitions, with crystal light and a full stage.",
        seating: ["Banquet", "Theatre", "U-shape"],
      };
    }
    if (h.id === "hall-2") {
      return {
        ...h,
        tag: "Outdoor conferences. Covered pavilion.",
        jp: "Outdoor conference",
        copy: "Lawn, fountain court, and a covered pavilion — made for outdoor conferences and exhibitions.",
        seating: ["Theatre", "Banquet", "Exhibition"],
      };
    }
    if (h.id === "hall-3") {
      return {
        ...h,
        name: "Heritage Courtyard (MINI)",
        tag: "Board meetings. Quiet inner court.",
        jp: "Board meetings",
        copy: "A quieter hall for board meetings and training, with a private inner court.",
        seating: ["Cluster", "U-shape"],
      };
    }
    return {
      ...h,
      tag: rewriteConventionCopy(h.tag),
      jp: rewriteConventionCopy(h.jp),
      copy: rewriteConventionCopy(h.copy),
    };
  });
  state.packages = (state.packages || []).map((pkg) => {
    if (pkg.id === "pkg-mandap" || /mandap evening/i.test(pkg.name || "")) return { ...pkg, name: "Workshop Day" };
    if (pkg.id === "pkg-royal" || /royal wedding/i.test(pkg.name || "")) return { ...pkg, name: "Grand Convention" };
    if (pkg.id === "pkg-garden" || /garden celebration/i.test(pkg.name || "")) return { ...pkg, name: "Outdoor Conference" };
    return pkg;
  });
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : createSeed();
    if (!Array.isArray(parsed.documents)) parsed.documents = [];
    if (!Array.isArray(parsed.expenses)) parsed.expenses = [];
    parsed.folios = (parsed.folios || []).map((f) => ({
      ...f,
      gstMode: f.gstMode === "without" ? "without" : "with",
      taxPercent:
        f.gstMode === "without"
          ? 0
          : f.taxPercent != null
            ? Number(f.taxPercent)
            : parsed.property?.taxPercent ?? 18,
    }));
    parsed.services = [];
    parsed.pricingRules = [];
    if (parsed.property) {
      const p = parsed.property;
      const beforeBanquet = p.banquetIntro || "";
      const beforeTerms = p.terms || "";
      if (p.notifyWhatsApp == null) p.notifyWhatsApp = true;
      if (!p.notifyPhone) p.notifyPhone = p.phone || "+91 98496 00555";
      if (!p.brandName) p.brandName = "Gayatri";
      if (!p.place) p.place = "Palagummi · Konaseema";
      if (!p.about) p.about = DEFAULT_ABOUT;
      p.banquetIntro = String(p.banquetIntro || DEFAULT_BANQUET)
        .replace(/Gayatri provides the venue[\s\S]*?arranged by you\.?/gi, "")
        .replace(/\s+/g, " ")
        .trim();
      if (!p.banquetIntro) p.banquetIntro = DEFAULT_BANQUET;
      p.terms = String(p.terms || DEFAULT_TERMS)
        .split(/\n+/)
        .map((line) => line.replace(/^\s*\d+[.)]\s*/, "").trim())
        .filter((line) => line && !/hall hire and guest rooms only/i.test(line) && !/catering,\s*decoration,\s*DJ/i.test(line))
        .join("\n");
      if (!p.terms) p.terms = DEFAULT_TERMS;
      if (!p.mapQuery) {
        p.mapQuery =
          "GAYATRI WATER AND BEVERAGES, Palagummi Village, Razole Mandal, Dr. B.R.A. Konaseema, Andhra Pradesh 533249";
      }
      if (!p.mapLat) p.mapLat = 16.4748165;
      if (!p.mapLng) p.mapLng = 81.875945;
      if (!Array.isArray(p.eventTypes) || !p.eventTypes.length) p.eventTypes = [...DEFAULT_EVENT_TYPES];
      if (!p.storiesCleared) {
        p.stories = [];
        p.storiesCleared = true;
      }
      if (!Array.isArray(p.stories)) p.stories = [];
      p.policies = { ...DEFAULT_POLICIES, ...(p.policies || {}) };
      if (!p.termSets?.sections) p.termSets = termSetsOf(p);
      if (p.banquetIntro !== beforeBanquet || p.terms !== beforeTerms) persist(parsed);
      if (normalizePropertyLive(p)) persist(parsed);
    }
    parsed.halls = (parsed.halls || []).map((h) => ({
      ...h,
      jp: h.jp || h.kind || "",
      copy: h.copy || h.tag || "",
      rates: {
        halfDay: Number(h.rates?.halfDay) || 0,
        fullDay: Number(h.rates?.fullDay) || 0,
      },
    }));
    parsed.hallReservations = (parsed.hallReservations || []).map((r) =>
      r.slotType === "hourly" ? { ...r, slotType: "half-day" } : r
    );
    if (!Array.isArray(parsed.roomTypes)) parsed.roomTypes = [];
    if (!Array.isArray(parsed.packages)) parsed.packages = [];
    if (!Array.isArray(parsed.agreements)) parsed.agreements = [];
    parsed.rooms = (parsed.rooms || []).map((r) => ({
      ...r,
      status: occupancyOf(r),
      hkStatus: housekeepingOf(r),
    }));
    if (!parsed.meta) parsed.meta = {};
    if (!parsed.meta.ledgerCleared) {
      parsed.guests = [];
      parsed.bookings = [];
      parsed.hallReservations = [];
      parsed.roomReservations = [];
      parsed.folios = [];
      parsed.folioLines = [];
      parsed.payments = [];
      parsed.invoices = [];
      parsed.events = [];
      parsed.cateringOrders = [];
      parsed.purchaseOrders = [];
      parsed.notifications = [];
      parsed.enquiries = [];
      parsed.documents = [];
      parsed.audit = [];
      parsed.rooms = (parsed.rooms || []).map((r) =>
        ["Occupied", "Reserved"].includes(r.status) ? { ...r, status: "Available" } : r
      );
      parsed.meta.ledgerCleared = true;
      persist(parsed);
      clearBlobs().catch(() => {});
    }
    if (!parsed.meta.roomsAllAvailable) {
      parsed.rooms = (parsed.rooms || []).map((r) => ({ ...r, status: "Available" }));
      parsed.meta.roomsAllAvailable = true;
      persist(parsed);
    }
    if (!parsed.meta.conventionHall) {
      applyConventionHallRebrand(parsed);
      parsed.meta.conventionHall = true;
      persist(parsed);
    }
    if (!parsed.meta.conventionHallTerms && parsed.property) {
      const p = parsed.property;
      if (p.termSets?.sections) {
        p.termSets.sections = Object.fromEntries(
          Object.entries(p.termSets.sections).map(([k, v]) => [k, rewriteConventionCopy(v)])
        );
      }
      if (p.terms) p.terms = rewriteConventionCopy(p.terms);
      parsed.meta.conventionHallTerms = true;
      persist(parsed);
    }
    if (!parsed.meta.hallTariffSep2026) {
      const tariff = {
        "hall-1": {
          capacityMin: 1000,
          capacity: 3000,
          floating: 3000,
          dining: 1500,
          rates: { hourly: 37500, halfDay: 300000, fullDay: 450000 },
          minValue: 300000,
          active: true,
        },
        "hall-2": {
          capacityMin: 800,
          capacity: 800,
          floating: 800,
          dining: 500,
          rates: { hourly: 16000, halfDay: 125000, fullDay: 250000 },
          minValue: 125000,
          active: true,
        },
        "hall-3": {
          capacityMin: 100,
          capacity: 500,
          floating: 500,
          dining: 250,
          rates: { hourly: 16000, halfDay: 125000, fullDay: 200000 },
          minValue: 125000,
          active: true,
        },
      };
      parsed.halls = (parsed.halls || []).map((h) => {
        const next = tariff[h.id];
        if (!next) return h;
        return { ...h, ...next, rates: { ...h.rates, ...next.rates } };
      });
      parsed.packages = (parsed.packages || []).map((pkg) => {
        if (pkg.id === "pkg-royal") {
          return { ...pkg, includes: ["Imperial Ballroom", "up to 3,000 guests", "full-day hall"], price: 450000, minGuests: 1000 };
        }
        if (pkg.id === "pkg-garden") {
          return { ...pkg, includes: ["Garden Pavilion", "up to 800 guests", "lawn and covered dining"], price: 250000, minGuests: 200 };
        }
        if (pkg.id === "pkg-mandap") {
          return { ...pkg, includes: ["Heritage Courtyard (MINI)", "up to 500 guests", "8-hour hall access"], price: 200000, minGuests: 100 };
        }
        return pkg;
      });
      parsed.meta.hallTariffSep2026 = true;
      persist(parsed);
    }
    if (!parsed.meta.heritageMiniSep2026) {
      const rename = (value) =>
        String(value || "").replace(/Heritage Courtyard(?!\s*\(MINI\))/gi, "Heritage Courtyard (MINI)");
      parsed.halls = (parsed.halls || []).map((h) =>
        h.id === "hall-3" || /^Heritage Courtyard$/i.test(h.name || "") ? { ...h, name: "Heritage Courtyard (MINI)" } : h
      );
      parsed.packages = (parsed.packages || []).map((pkg) => ({
        ...pkg,
        includes: (pkg.includes || []).map(rename),
      }));
      parsed.bookings = (parsed.bookings || []).map((b) => (b.hall ? { ...b, hall: rename(b.hall) } : b));
      parsed.enquiries = (parsed.enquiries || []).map((e) => (e.hall ? { ...e, hall: rename(e.hall) } : e));
      parsed.meta.heritageMiniSep2026 = true;
      persist(parsed);
    }
    if (!parsed.meta.roomInventorySep2026) {
      const liveIds = new Set(
        (parsed.roomReservations || [])
          .filter((r) => !["Cancelled", "Checked out"].includes(r.status))
          .map((r) => r.roomId)
      );
      const next = defaultRooms().map((room) => {
        const old = (parsed.rooms || []).find((r) => r.id === room.id || String(r.number) === room.number);
        if (old && liveIds.has(old.id)) {
          return { ...room, id: old.id, status: old.status, hkStatus: old.hkStatus || "Clean" };
        }
        return room;
      });
      const kept = (parsed.rooms || []).filter((r) => liveIds.has(r.id) && !next.some((n) => n.id === r.id));
      parsed.roomTypes = defaultRoomTypes();
      parsed.rooms = [...next, ...kept];
      parsed.meta.roomInventorySep2026 = true;
      persist(parsed);
    }
    if (!parsed.meta.roomTariffSep2026) {
      const types = defaultRoomTypes();
      const byId = new Map((parsed.roomTypes || []).map((t) => [t.id, t]));
      const known = new Set(types.map((t) => t.id));
      parsed.roomTypes = [
        ...types.map((t) => ({ ...(byId.get(t.id) || {}), ...t })),
        ...(parsed.roomTypes || []).filter((t) => !known.has(t.id)),
      ];
      const have = new Set((parsed.rooms || []).map((r) => String(r.number)));
      const extra = defaultRooms().filter((r) => !have.has(r.number));
      if (extra.length) parsed.rooms = [...(parsed.rooms || []), ...extra];
      parsed.meta.roomTariffSep2026 = true;
      persist(parsed);
    }
    if (!parsed.meta.royalRetreatTypeSep2026) {
      const retreat = defaultRetreatType();
      const list = parsed.roomTypes || [];
      const i = list.findIndex((t) => t.id === retreat.id || /royal family retreat/i.test(t.name || ""));
      if (i < 0) parsed.roomTypes = [...list, retreat];
      else parsed.roomTypes = list.map((t, idx) => (idx === i ? { ...t, ...retreat } : t));
      parsed.meta.royalRetreatTypeSep2026 = true;
      persist(parsed);
    }
    if (!parsed.meta.palagummiMapSep2026 && parsed.property) {
      const p = parsed.property;
      const q = String(p.mapQuery || "");
      const isOld =
        !q ||
        /Dr\.?\s*B\.?R\.?A\.?/i.test(q) ||
        /Palagummi Village Razole Mandal/i.test(q);
      p.mapLat = 16.4748165;
      p.mapLng = 81.875945;
      if (isOld) p.mapQuery = "16.4748165, 81.875945";
      parsed.meta.palagummiMapSep2026 = true;
      persist(parsed);
    }
    if (!parsed.meta.gayatriWaterMapSep2026 && parsed.property) {
      const p = parsed.property;
      p.mapLat = p.mapLat || 16.4748165;
      p.mapLng = p.mapLng || 81.875945;
      p.mapQuery =
        "GAYATRI WATER AND BEVERAGES, Palagummi Village, Razole Mandal, Dr. B.R.A. Konaseema, Andhra Pradesh 533249";
      parsed.meta.gayatriWaterMapSep2026 = true;
      persist(parsed);
    }
    if (!parsed.meta.termLocalesSep2026 && parsed.property) {
      const next = termSetsOf(parsed.property);
      parsed.property.termSets = {
        version: next.version,
        publishedAt: next.publishedAt,
        sections: next.sections,
        locales: next.locales,
      };
      parsed.meta.termLocalesSep2026 = true;
      persist(parsed);
    }
    if (!parsed.meta.roomCheckInOut24Sep2026 && parsed.property) {
      parsed.property.policies = {
        ...(parsed.property.policies || {}),
        roomCheckInOut: "24 hrs",
      };
      if (parsed.property.termSets?.locales || parsed.property.termSets?.sections) {
        const ts = parsed.property.termSets;
        ts.sections = { ...ts.sections, room: DEFAULT_TERM_SECTIONS.room };
        ts.locales = {
          ...ts.locales,
          en: { ...ts.locales?.en, room: DEFAULT_TERM_SECTIONS.room },
          te: { ...ts.locales?.te, room: DEFAULT_TERM_SECTIONS_TE.room },
          hi: { ...ts.locales?.hi, room: DEFAULT_TERM_SECTIONS_HI.room },
        };
      }
      parsed.meta.roomCheckInOut24Sep2026 = true;
      persist(parsed);
    }
    if (!parsed.meta.gayatriConventionTermsSep2026) parsed.meta.gayatriConventionTermsSep2026 = true;
    if (!parsed.meta.marriageReceptionEventsSep2026) parsed.meta.marriageReceptionEventsSep2026 = true;
    if (!parsed.meta.gayatriConventionBrandingSep2026) parsed.meta.gayatriConventionBrandingSep2026 = true;
    pruneEvents(parsed);
    return parsed;
  } catch {
    return createSeed();
  }
}

function pruneEvents(state) {
  state.events = (state.events || []).filter((e) => {
    const bk = (state.bookings || []).find((b) => b.id === e.bookingId);
    return bk && bk.status !== "Cancelled";
  });
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

/** Removes all bookings, guests, payments and invoices. Keeps halls, rooms, rates and property settings. */
export async function clearAllBookings() {
  await clearBlobs().catch(() => {});
  const state = load();
  state.guests = [];
  state.bookings = [];
  state.hallReservations = [];
  state.roomReservations = [];
  state.folios = [];
  state.folioLines = [];
  state.payments = [];
  state.invoices = [];
  state.events = [];
  state.cateringOrders = [];
  state.purchaseOrders = [];
  state.notifications = [];
  state.enquiries = [];
  state.documents = [];
  state.agreements = [];
  state.rooms = (state.rooms || []).map((r) => ({
    ...r,
    status: "Available",
    hkStatus: ["Dirty", "Cleaning"].includes(housekeepingOf(r)) ? "Clean" : housekeepingOf(r),
  }));
  state.audit = [];
  audit(state, "All bookings cleared", "—", "Dashboard and reservations reset to zero");
  return persist(state);
}

function recordAgreement(state, { bookingId, guestId, sections, source }) {
  const agreed = (sections || []).filter(Boolean);
  if (!agreed.length) return;
  const sets = termSetsOf(state.property);
  const user = state.users.find((u) => u.id === state.session.userId);
  state.agreements = [
    {
      id: uid("ag"),
      bookingId,
      guestId,
      at: new Date().toISOString(),
      userId: state.session.userId,
      user: source === "Website" ? "Website guest" : user?.name || "Staff",
      source: source || "Staff",
      version: sets.version || 1,
      sections: agreed,
    },
    ...(state.agreements || []),
  ];
}

export function updateProperty(patch) {
  const state = load();
  state.property = { ...state.property, ...patch };
  if (patch.termSets?.sections) {
    const prev = termSetsOf({ termSets: patch.termSets.version ? patch.termSets : state.property.termSets });
    const version = Number(patch.termSets.version) || (Number(prev.version) || 1);
    state.property.termSets = {
      version,
      publishedAt: patch.termSets.publishedAt || new Date().toISOString(),
      sections: { ...prev.sections, ...patch.termSets.sections },
      locales: {
        en: { ...prev.locales.en, ...(patch.termSets.locales?.en || patch.termSets.sections) },
        te: { ...prev.locales.te, ...(patch.termSets.locales?.te || {}) },
        hi: { ...prev.locales.hi, ...(patch.termSets.locales?.hi || {}) },
      },
    };
    state.property.terms = Object.values(state.property.termSets.sections).filter(Boolean).join("\n");
  }
  if (patch.policies) {
    state.property.policies = { ...DEFAULT_POLICIES, ...(state.property.policies || {}), ...patch.policies };
  }
  audit(state, "Property updated", state.property.name, Object.keys(patch).join(", "));
  return persist(state);
}

export function publishTermSets(payload) {
  const state = load();
  const prev = termSetsOf(state.property);
  const bump = Boolean(prev.publishedAt);
  const sections = payload?.sections || payload;
  const locales = payload?.locales || {};
  const en = { ...prev.sections, ...sections, ...(locales.en || {}) };
  state.property.termSets = {
    version: bump ? (Number(prev.version) || 1) + 1 : Math.max(1, Number(prev.version) || 1),
    publishedAt: new Date().toISOString(),
    sections: en,
    locales: {
      en,
      te: { ...prev.locales.te, ...(locales.te || {}) },
      hi: { ...prev.locales.hi, ...(locales.hi || {}) },
    },
  };
  state.property.terms = Object.values(state.property.termSets.sections).filter(Boolean).join("\n");
  audit(state, "Terms published", `v${state.property.termSets.version}`, "Staff T&C master");
  return persist(state);
}

export function setRoomStatus(roomId, status) {
  const HK = ["Clean", "Dirty", "Cleaning", "Inspected"];
  if (HK.includes(status)) return setRoomHousekeeping(roomId, status);
  const state = load();
  const room = state.rooms.find((r) => r.id === roomId);
  const prev = occupancyOf(room);
  state.rooms = state.rooms.map((r) => (r.id === roomId ? { ...r, status } : r));
  audit(state, "Room occupancy", `Room ${room?.number}`, `${prev} → ${status}`);
  return persist(state);
}

export function setRoomHousekeeping(roomId, hkStatus) {
  const state = load();
  const room = state.rooms.find((r) => r.id === roomId);
  const prev = housekeepingOf(room);
  state.rooms = state.rooms.map((r) => (r.id === roomId ? { ...r, hkStatus } : r));
  audit(state, "Housekeeping", `Room ${room?.number}`, `${prev} → ${hkStatus}`);
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
    capacityMin: Number(item.capacityMin) || 0,
    floating: Number(item.floating) || 0,
    dining: Number(item.dining) || 0,
    parking: Number(item.parking) || 0,
    setupHours: Number(item.setupHours) || 0,
    teardownHours: Number(item.teardownHours) || 0,
    bufferMinutes: Number(item.bufferMinutes) || 0,
    minValue: Number(item.minValue) || 0,
    rates: {
      halfDay: Number(item.rates?.halfDay) || 0,
      fullDay: Number(item.rates?.fullDay) || 0,
    },
    seating: Array.isArray(item.seating) ? item.seating : String(item.seating || "").split(",").map((s) => s.trim()).filter(Boolean),
    active: item.active !== false,
  };
  state.halls = upsert(state.halls, hall, "hall");
  state.packages = (state.packages || []).map((pkg) => {
    if (pkg.hallId !== hall.id) return pkg;
    const includes = [hall.name];
    if (hall.capacity) includes.push(`up to ${Number(hall.capacity).toLocaleString("en-IN")} guests`);
    if (hall.rates.fullDay) includes.push("full-day hall");
    return {
      ...pkg,
      price: hall.rates.fullDay || pkg.price,
      minGuests: hall.capacityMin || pkg.minGuests,
      includes: includes.length > 1 ? includes : pkg.includes,
    };
  });
  audit(state, "Master data", hall.name, "Hall saved");
  return persist(state);
}

export function saveRoomType(item) {
  const state = load();
  const row = {
    ...item,
    composition: String(item.composition || "").trim(),
    baseRate: Number(item.baseRate) || 0,
    extraBed: Number(item.extraBed) || 0,
    extraBeds: Number(item.extraBeds) || 0,
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

export function removeRoom(id) {
  const state = load();
  const room = state.rooms.find((r) => r.id === id);
  if (!room) return { error: "Room not found." };
  const live = (state.roomReservations || []).some(
    (r) => r.roomId === id && !["Cancelled", "Checked out"].includes(r.status)
  );
  if (live) return { error: `Room ${room.number} has a live booking. Cancel or check out that stay first.` };
  state.rooms = state.rooms.filter((r) => r.id !== id);
  audit(state, "Master data", `Room ${room.number}`, "Room removed");
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
  const row = {
    ...guest,
    gstin: String(guest.gstin || "").trim().toUpperCase(),
  };
  if (row.id) {
    state.guests = state.guests.map((g) => (g.id === row.id ? { ...g, ...row } : g));
    audit(state, "Guest updated", row.name, row.phone);
  } else {
    row.id = uid("g");
    state.guests.unshift(row);
    audit(state, "Guest created", row.name, row.phone);
  }
  persist(state);
  return { state: load(), guest: row };
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
    guest = {
      id: uid("g"),
      ...draft.guest,
      gstin: String(draft.guest.gstin || "").trim().toUpperCase(),
      idProof: draft.guest.idProof || { type: "Aadhaar", number: "" },
      tags: [draft.source || "Direct"],
    };
    state.guests.unshift(guest);
  } else if (draft.guest.gstin) {
    guest.gstin = String(draft.guest.gstin).trim().toUpperCase();
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
    termsVersion: termSetsOf(state.property).version || 1,
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
      room.id === r.roomId && occupancyOf(room) === "Available"
        ? { ...room, status: "Reserved" }
        : room
    );
  });

  const folio = {
    id: uid("fo"),
    bookingId: booking.id,
    discount: Number(draft.discount) || 0,
    taxPercent: draft.gstMode === "without" ? 0 : state.property.taxPercent,
    gstMode: draft.gstMode === "without" ? "without" : "with",
    status: "Open",
  };
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
      at: dayToISO(draft.paymentDate),
      ref: draft.paymentRef || "",
    });
    state.invoices.unshift({
      id: uid("inv"),
      number: seqNo(state.invoices, "number", "AR"),
      type: "Advance receipt",
      bookingId: booking.id,
      folioId: folio.id,
      at: dayToISO(draft.paymentDate),
      status: "Issued",
    });
  }

  const finalPay = Number(draft.finalPayment) || 0;
  if (finalPay > 0) {
    state.payments.unshift({
      id: uid("pay"),
      folioId: folio.id,
      bookingId: booking.id,
      amount: finalPay,
      method: draft.finalPaymentMode || draft.paymentMode || "Cash",
      type: "Final",
      at: dayToISO(draft.finalPaymentDate || draft.paymentDate),
      ref: draft.finalPaymentRef || "",
    });
    state.invoices.unshift({
      id: uid("inv"),
      number: seqNo(state.invoices, "number", "FN"),
      type: "Final invoice",
      bookingId: booking.id,
      folioId: folio.id,
      at: dayToISO(draft.finalPaymentDate || draft.paymentDate),
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

  const { totals: afterPay } = bookingFolio(state, booking.id);
  if (afterPay.balance <= 0 && afterPay.total > 0) {
    booking.status = "Confirmed";
    const f = state.folios.find((x) => x.id === folio.id);
    if (f) f.status = "Settled";
  }

  audit(state, "Booking created", booking.number, `${guest.name} · ${booking.type}`);
  const agreed = [];
  if ((draft.halls || []).length && draft.agreeHall) agreed.push("hall");
  if ((draft.rooms || []).length && draft.agreeRoom) agreed.push("room");
  recordAgreement(state, { bookingId: booking.id, guestId: guest.id, sections: agreed, source: "Staff" });
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
    at: payload.date ? dayToISO(payload.date) : payload.at || new Date().toISOString(),
    ref: payload.ref || "",
  };
  state.payments.unshift(pay);
  const prefix = pay.type === "Refund" ? "RF" : pay.type === "Advance" ? "AR" : pay.type === "Final" ? "FN" : "RC";
  const invType =
    pay.type === "Refund"
      ? "Refund receipt"
      : pay.type === "Advance"
        ? "Advance receipt"
        : pay.type === "Final"
          ? "Final invoice"
          : "Payment receipt";
  state.invoices.unshift({
    id: uid("inv"),
    number: seqNo(state.invoices, "number", prefix),
    type: invType,
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
    pay.type === "Refund" ? "Refund posted" : pay.type === "Final" ? "Final payment recorded" : "Payment recorded",
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

export function setFolioGstMode(folioId, gstMode) {
  const state = load();
  const folio = state.folios.find((f) => f.id === folioId);
  if (!folio) return { error: "Folio not found" };
  const mode = gstMode === "without" ? "without" : "with";
  folio.gstMode = mode;
  folio.taxPercent = mode === "without" ? 0 : state.property.taxPercent;
  if (folio.status === "Settled") folio.status = "Open";
  audit(state, "GST mode updated", folio.bookingId, mode === "with" ? "With GST" : "Without GST");
  return persist(state);
}

export function addFolioCharge(folioId, payload) {
  const state = load();
  const folio = state.folios.find((f) => f.id === folioId);
  if (!folio) return { error: "Folio not found" };
  const qty = Math.max(1, Number(payload.qty) || 1);
  const unitPrice = Number(payload.unitPrice) || 0;
  const category = payload.category || "other";
  const description = String(payload.description || category).trim() || category;
  const line = {
    id: uid("line"),
    folioId,
    category,
    description,
    qty,
    unitPrice,
    amount: Math.round(qty * unitPrice),
  };
  state.folioLines.push(line);
  if (folio.status === "Settled") folio.status = "Open";
  audit(state, "Charge added", folio.bookingId, `${description} · ${line.amount}`);
  return persist(state);
}

export function removeFolioCharge(lineId) {
  const state = load();
  const line = (state.folioLines || []).find((l) => l.id === lineId);
  state.folioLines = (state.folioLines || []).filter((l) => l.id !== lineId);
  if (line) audit(state, "Charge removed", line.folioId, line.description || line.category);
  return persist(state);
}

export function addExpense(payload) {
  const state = load();
  if (!Array.isArray(state.expenses)) state.expenses = [];
  const row = {
    id: uid("exp"),
    date: String(payload.date || "").slice(0, 10) || todayISO(),
    department: payload.department || "Common",
    category: payload.category || "other",
    amount: Number(payload.amount) || 0,
    method: payload.method || "Cash",
    description: String(payload.description || "").trim(),
    at: new Date().toISOString(),
    createdBy: state.session?.userId || "",
  };
  if (row.amount <= 0) return { error: "Enter an amount greater than zero" };
  state.expenses.unshift(row);
  audit(state, "Expense recorded", row.category, `${row.department} · ${row.amount}`);
  return persist(state);
}

export function removeExpense(id) {
  const state = load();
  const row = (state.expenses || []).find((e) => e.id === id);
  state.expenses = (state.expenses || []).filter((e) => e.id !== id);
  if (row) audit(state, "Expense removed", row.category, String(row.amount));
  return persist(state);
}

export function cancelBooking(bookingId, refund) {
  const state = load();
  const bk = state.bookings.find((b) => b.id === bookingId);
  if (!bk || bk.status === "Cancelled") return state;
  bk.status = "Cancelled";
  bk.cancelledAt = new Date().toISOString();
  state.hallReservations = state.hallReservations.map((r) =>
    r.bookingId === bookingId ? { ...r, status: "Cancelled" } : r
  );
  state.roomReservations = state.roomReservations.map((r) =>
    r.bookingId === bookingId ? { ...r, status: "Cancelled" } : r
  );
  for (const r of (state.roomReservations || []).filter((x) => x.bookingId === bookingId)) {
    if (!liveStaysForRoom(state, r.roomId, bookingId)) {
      state.rooms = state.rooms.map((room) =>
        room.id === r.roomId && ["Occupied", "Reserved"].includes(room.status)
          ? { ...room, status: "Available" }
          : room
      );
    }
  }
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
  pruneEvents(state);
  return persist(state);
}

/** Cancel one room stay on a booking. Keeps hall booking and bill. No refund by default. */
export function cancelRoomStay(resId, { refund = 0 } = {}) {
  const state = load();
  const res = (state.roomReservations || []).find((r) => r.id === resId);
  if (!res || res.status === "Cancelled") return { error: "Room stay not found" };
  const room = state.rooms.find((r) => r.id === res.roomId);
  res.status = "Cancelled";
  if (!liveStaysForRoom(state, res.roomId, res.bookingId)) {
    state.rooms = state.rooms.map((r) =>
      r.id === res.roomId && ["Occupied", "Reserved"].includes(r.status)
        ? { ...r, status: "Available", hkStatus: "Dirty" }
        : r
    );
  }
  const folio = state.folios.find((f) => f.bookingId === res.bookingId);
  if (folio) {
    const roomNo = room?.number || "";
    state.folioLines = (state.folioLines || []).filter((l) => {
      if (l.folioId !== folio.id) return true;
      if (l.category !== "room") return true;
      if (roomNo && String(l.description || "").includes(`Room ${roomNo}`)) return false;
      return true;
    });
    if (folio.status === "Settled") folio.status = "Open";
    if (refund > 0) {
      state.payments.unshift({
        id: uid("pay"),
        folioId: folio.id,
        bookingId: res.bookingId,
        amount: Number(refund),
        method: "Bank transfer",
        type: "Refund",
        at: new Date().toISOString(),
        ref: `Room ${roomNo} cancelled`,
      });
    }
  }
  const bk = state.bookings.find((b) => b.id === res.bookingId);
  audit(
    state,
    "Room stay cancelled",
    bk?.number || res.bookingId,
    `Room ${room?.number || ""} · ${refund > 0 ? `Refund ${refund}` : "No refund"}`
  );
  return persist(state);
}

function liveStaysForRoom(state, roomId, ignoreBookingId) {
  return (state.roomReservations || []).some(
    (r) =>
      r.roomId === roomId &&
      r.bookingId !== ignoreBookingId &&
      !["Cancelled", "Checked out"].includes(r.status)
  );
}

function purgeBooking(state, bookingId, { keepGuest } = {}) {
  const bk = state.bookings.find((b) => b.id === bookingId);
  if (!bk) return;
  const guestId = bk.guestId;
  for (const r of (state.roomReservations || []).filter((x) => x.bookingId === bookingId)) {
    if (!liveStaysForRoom(state, r.roomId, bookingId)) {
      state.rooms = state.rooms.map((room) =>
        room.id === r.roomId && ["Occupied", "Reserved"].includes(room.status)
          ? { ...room, status: "Available" }
          : room
      );
    }
  }
  state.bookings = state.bookings.filter((b) => b.id !== bookingId);
  state.hallReservations = (state.hallReservations || []).filter((r) => r.bookingId !== bookingId);
  state.roomReservations = (state.roomReservations || []).filter((r) => r.bookingId !== bookingId);
  state.events = (state.events || []).filter((e) => e.bookingId !== bookingId);
  if (!keepGuest) {
    const still = state.bookings.some((b) => b.guestId === guestId && b.status !== "Cancelled");
    if (!still) state.guests = state.guests.filter((g) => g.id !== guestId);
  }
}

export function removeBooking(bookingId) {
  const state = load();
  const bk = state.bookings.find((b) => b.id === bookingId);
  if (!bk) return state;
  const label = `${bk.number} · ${bk.guestId}`;
  purgeBooking(state, bookingId);
  audit(state, "Booking deleted", bk.number, label);
  return persist(state);
}

export function removeGuest(guestId) {
  const state = load();
  const guest = state.guests.find((g) => g.id === guestId);
  if (!guest) return state;
  const ids = state.bookings.filter((b) => b.guestId === guestId).map((b) => b.id);
  ids.forEach((id) => purgeBooking(state, id, { keepGuest: true }));
  state.guests = state.guests.filter((g) => g.id !== guestId);
  audit(state, "Guest deleted", guest.name, guest.phone);
  return persist(state);
}

export function checkInRoom(resId) {
  const state = load();
  const res = state.roomReservations.find((r) => r.id === resId);
  if (res) {
    res.status = "Occupied";
    res.checkedInAt = new Date().toISOString();
    const user = state.users.find((u) => u.id === state.session.userId);
    res.checkedInBy = user?.name || "";
    state.rooms = state.rooms.map((r) => (r.id === res.roomId ? { ...r, status: "Occupied" } : r));
    const bk = state.bookings.find((b) => b.id === res.bookingId);
    if (bk && bk.status === "Confirmed") bk.status = "Checked-in";
    audit(state, "Check-in", res.roomId, res.guestId);
  }
  return persist(state);
}

export function checkOutRoom(resId) {
  const state = load();
  const res = state.roomReservations.find((r) => r.id === resId);
  if (res) {
    res.status = "Checked out";
    res.checkedOutAt = new Date().toISOString();
    state.rooms = state.rooms.map((r) =>
      r.id === res.roomId ? { ...r, status: "Available", hkStatus: "Dirty" } : r
    );
    audit(state, "Check-out", res.roomId, "Occupancy Available · Housekeeping Dirty");
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
  state.rooms = state.rooms.map((r) =>
    r.id === prev ? { ...r, status: "Available", hkStatus: "Dirty" } : r
  );
  res.roomId = newRoomId;
  state.rooms = state.rooms.map((r) =>
    r.id === newRoomId ? { ...r, status: res.status === "Occupied" ? "Occupied" : "Reserved" } : r
  );
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
    termsVersion: termSetsOf(state.property).version || 1,
  };
  state.bookings.unshift(booking);
  const agreed = [];
  if (enq.agreeHall) agreed.push("hall");
  if (enq.agreeRoom) agreed.push("room");
  recordAgreement(state, { bookingId: booking.id, guestId: guest.id, sections: agreed, source: "Website" });
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
const MAX_VIDEO = 100 * 1024 * 1024;

function isVideoFile(file) {
  return /^video\//.test(file.type || "") || /\.(mp4|mov|webm|m4v|avi|mkv)$/i.test(file.name || "");
}

function isAllowedUpload(file) {
  return (
    /^(image\/|application\/pdf|video\/)/.test(file.type || "") ||
    /\.(pdf|jpe?g|png|webp|gif|mp4|mov|webm|m4v|avi|mkv)$/i.test(file.name || "")
  );
}

export async function attachDocument({ bookingId, guestId, typeId, file }) {
  if (!file) return { error: "Choose a file." };
  const video = isVideoFile(file);
  const limit = video ? MAX_VIDEO : MAX_DOC;
  if (file.size > limit) {
    return { error: video ? "Each video must be under 100 MB." : "Each file must be under 8 MB." };
  }
  if (!isAllowedUpload(file)) {
    return { error: "Upload PDF, image (JPG, PNG, WebP) or video (MP4, MOV, WebM)." };
  }
  const spec = specById(typeId);
  const id = uid("doc");
  await putBlob(id, file);
  const state = load();
  const same = (state.documents || []).filter(
    (d) => d.typeId === typeId && ((bookingId && d.bookingId === bookingId) || (!bookingId && guestId && d.guestId === guestId))
  );
  for (const old of same) await deleteBlob(old.id);
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
  state.documents = [rec, ...(state.documents || []).filter((d) => !same.some((old) => old.id === d.id))];
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

/**
 * Loads a full sample day for management training:
 * hall-only, room-only, mixed (hall + rooms on different days),
 * all payment modes, room cancel without refund, expenses, credit balances.
 */
export function loadManagementSample() {
  const today = todayISO();
  const tomorrow = addDays(today, 1);
  const dayAfter = addDays(today, 2);

  // Start from clean transactional data, keep property/halls/rooms
  clearAllBookingsSync();
  let state = load();
  const halls = (state.halls || []).filter((h) => h.active !== false);
  const rooms = state.rooms || [];
  const hall1 = halls[0];
  const hall2 = halls[1] || halls[0];
  const roomA = rooms[0];
  const roomB = rooms[1] || rooms[0];
  const roomC = rooms[2] || rooms[0];
  if (!hall1 || !roomA) {
    return { error: "Add at least one hall and one room in Master data first." };
  }

  function hallHold(hallId, date, slotType = "full-day") {
    const start = slotType === "half-day" ? `${date}T18:00` : `${date}T06:00`;
    const end = slotType === "half-day" ? `${addDays(date, 1)}T00:00` : `${addDays(date, 1)}T06:00`;
    return { hallId, date, slotType, start, end };
  }

  // 1) Hall only · With GST · Advance Cash · CREDIT (balance due)
  createReservation({
    guest: { name: "Sample Hall Party", phone: "9000000001", email: "", address: "Palagummi", gstin: "", nationality: "India", idProof: { type: "Aadhaar", number: "XXXX" } },
    type: "Reception",
    source: "Direct",
    eventDate: today,
    checkIn: today,
    checkOut: tomorrow,
    guestsExpected: 400,
    halls: [hallHold(hall1.id, today, "full-day")],
    rooms: [],
    discount: 0,
    gstMode: "with",
    advance: 100000,
    paymentMode: "Cash",
    paymentDate: today,
    paymentRef: "SAMPLE-CASH-ADV",
    finalPayment: 0,
    notes: "Sample: hall only · Cash advance · balance is credit",
    agreeHall: true,
    agreeRoom: false,
  });

  // 2) Room only · With GST · Advance UPI · then Card settlement · PAID
  const roomOnly = createReservation({
    guest: { name: "Sample Room Guest", phone: "9000000002", email: "", address: "", gstin: "", nationality: "India", idProof: { type: "Aadhaar", number: "YYYY" } },
    type: "Room only",
    source: "Walk-in",
    eventDate: today,
    checkIn: today,
    checkOut: tomorrow,
    guestsExpected: 2,
    halls: [],
    rooms: [{ roomId: roomA.id, checkIn: today, checkOut: tomorrow, adults: 2, children: 0, extraBed: 0 }],
    discount: 0,
    gstMode: "with",
    advance: 1000,
    paymentMode: "UPI",
    paymentDate: today,
    paymentRef: "UPI/SAMPLE/001",
    finalPayment: 0,
    notes: "Sample: room only · UPI advance + Card settlement",
    agreeHall: false,
    agreeRoom: true,
  });
  {
    const st = load();
    const folio = st.folios.find((f) => f.bookingId === roomOnly.booking?.id);
    const { totals } = bookingFolio(st, roomOnly.booking?.id);
    if (folio && totals.balance > 0) {
      addPayment(folio.id, { amount: totals.balance, method: "Card", type: "Final", date: today, ref: "CARD-SAMPLE" });
    }
  }

  // 3) Mixed · Hall TODAY, rooms TOMORROW (different days) · Bank advance · partial
  const mixed = createReservation({
    guest: { name: "Sample Mixed Family", phone: "9000000003", email: "", address: "Razole", gstin: "36AAAAA0000A1Z5", nationality: "India", idProof: { type: "Aadhaar", number: "ZZZZ" } },
    type: "Marriages",
    source: "Phone",
    eventDate: today,
    checkIn: tomorrow,
    checkOut: dayAfter,
    guestsExpected: 800,
    halls: [hallHold(hall2.id, today, "full-day")],
    rooms: [
      { roomId: roomB.id, checkIn: tomorrow, checkOut: dayAfter, adults: 2, children: 1, extraBed: 1 },
      { roomId: roomC.id, checkIn: tomorrow, checkOut: dayAfter, adults: 2, children: 0, extraBed: 0 },
    ],
    discount: 10000,
    gstMode: "with",
    advance: 200000,
    paymentMode: "Bank transfer",
    paymentDate: today,
    paymentRef: "NEFT-SAMPLE",
    finalPayment: 0,
    notes: "Sample: hall today + rooms different days · Bank advance · credit balance",
    agreeHall: true,
    agreeRoom: true,
  });

  if (mixed?.error) return { error: mixed.error };

  // 4) Cancel one room on mixed booking — NO refund; bill stays for hall + remaining room
  state = load();
  const mixedRooms = (state.roomReservations || []).filter(
    (r) => r.bookingId === mixed.booking?.id && r.status !== "Cancelled"
  );
  if (mixedRooms[0]) {
    cancelRoomStay(mixedRooms[0].id, { refund: 0 });
  }

  // 5) Without GST · hall half-day · Net banking · settle full
  const freeHall = halls.find((h) => h.id !== hall1.id && h.id !== hall2.id) || hall2;
  const noGst = createReservation({
    guest: { name: "Sample No-GST Client", phone: "9000000004", email: "", address: "", gstin: "", nationality: "India", idProof: { type: "Aadhaar", number: "NNNN" } },
    type: "Conference",
    source: "Direct",
    eventDate: today,
    checkIn: today,
    checkOut: tomorrow,
    guestsExpected: 120,
    halls: [hallHold(freeHall.id, today, "half-day")],
    rooms: [],
    discount: 0,
    gstMode: "without",
    advance: 50000,
    paymentMode: "Cash",
    paymentDate: today,
    finalPayment: 0,
    notes: "Sample: Without GST · Cash advance + Net banking settlement",
    agreeHall: true,
    agreeRoom: false,
  });
  if (noGst?.error) return { error: noGst.error };
  {
    const st = load();
    const folio = st.folios.find((f) => f.bookingId === noGst.booking?.id);
    const { totals } = bookingFolio(st, noGst.booking?.id);
    if (folio && totals.balance > 0) {
      addPayment(folio.id, { amount: totals.balance, method: "Net banking", type: "Final", date: today, ref: "NB-SAMPLE" });
    }
  }

  // Extra charges + settlement payment on first open folio if needed
  state = load();
  const openFolio = (state.folios || []).find((f) => f.status === "Open");
  if (openFolio) {
    addFolioCharge(openFolio.id, { category: "food", description: "Sample catering charge", qty: 1, unitPrice: 15000 });
    addFolioCharge(openFolio.id, { category: "tea", description: "Tea / coffee service", qty: 1, unitPrice: 2500 });
  }

  // Daily expenses
  addExpense({ date: today, department: "Hotel", category: "diesel", amount: 5000, method: "Cash", description: "Generator diesel — sample" });
  addExpense({ date: today, department: "Function Hall", category: "tea", amount: 2500, method: "UPI", description: "Tea & refreshments — sample" });
  addExpense({ date: today, department: "Hotel", category: "cleaning", amount: 3000, method: "Cash", description: "Cleaning materials — sample" });
  addExpense({ date: today, department: "Admin", category: "salaries", amount: 8000, method: "Bank transfer", description: "Day wages — sample" });
  addExpense({ date: today, department: "Common", category: "other", amount: 1500, method: "UPI", description: "Misc — sample" });

  audit(load(), "Sample day loaded", today, "Hall/room/payments/expenses/credit demo");
  return load();
}

/** Sync clear used by sample loader (no IndexedDB wait). */
function clearAllBookingsSync() {
  const state = load();
  state.guests = [];
  state.bookings = [];
  state.hallReservations = [];
  state.roomReservations = [];
  state.folios = [];
  state.folioLines = [];
  state.payments = [];
  state.invoices = [];
  state.events = [];
  state.cateringOrders = [];
  state.purchaseOrders = [];
  state.notifications = [];
  state.enquiries = [];
  state.documents = [];
  state.agreements = [];
  state.expenses = [];
  state.rooms = (state.rooms || []).map((r) => ({
    ...r,
    status: "Available",
    hkStatus: "Clean",
  }));
  state.audit = [];
  persist(state);
}
