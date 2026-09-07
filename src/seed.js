import { DEFAULT_POLICIES, DEFAULT_TERM_SECTIONS, TERM_SECTIONS, defaultTermSets } from "./policies";

export { termsLines } from "./policies";

export const ROLES = {
  admin: {
    label: "Administrator",
    permissions: ["*"],
  },
  manager: {
    label: "Property manager",
    permissions: [
      "dashboard",
      "calendar",
      "venues",
      "rooms",
      "reservations",
      "guests",
      "events",
      "catering",
      "vendors",
      "billing",
      "reports",
      "documents",
      "expenses",
      "settings.property",
    ],
  },
  frontdesk: {
    label: "Front desk",
    permissions: ["dashboard", "calendar", "rooms", "reservations", "guests", "billing", "documents", "expenses"],
  },
  housekeeping: {
    label: "Housekeeping",
    permissions: ["dashboard", "rooms", "calendar"],
  },
  accounts: {
    label: "Accounts",
    permissions: ["dashboard", "billing", "reports", "vendors", "expenses"],
  },
};

export const DEFAULT_EVENT_TYPES = [
  "Marriages",
  "Reception",
  "Conference",
  "Seminar",
  "Corporate meeting",
  "Exhibition",
  "Training / Workshop",
  "Product launch",
  "Annual day / AGM",
  "Family retreat",
  "Other",
];

export const DEFAULT_STORIES = [
  {
    quote:
      "The Imperial Ballroom held 1,100 delegates without feeling crowded. Breakout lounges were ready, and the desk stayed till the last coach left.",
    cite: "Coastal Bank — Annual conference",
  },
  {
    quote: "We needed a covered outdoor session and an indoor plenary. Gayatri gave us both, plus a rain plan we never needed.",
    cite: "East Godavari Chamber — Trade meet",
  },
  {
    quote: "From training to the evening programme, one estate, three halls. We would book again for our AGM.",
    cite: "Delta Co-op — Three-day convention",
  },
];

export const DEFAULT_ABOUT =
  "Gayatri Convention in Palagummi Village, Razole Mandal, Dr. B.R. Ambedkar Konaseema District, Andhra Pradesh 533249. We hire venues and guest rooms for conferences, seminars, exhibitions, and corporate programmes. Catering, decoration, AV beyond the venue fit-out, and photography are arranged by the organiser — we do not sell those services.";

export const DEFAULT_BANQUET =
  "Venue hire is billed as the venue plus the hours you book. Guest rooms are billed separately. Tell us the date, venue, and delegate count. Your caterer, decorator, AV vendor, and photographer work on your programme — Gayatri does not provide those.";

export const DEFAULT_TERMS = TERM_SECTIONS.map((s) => DEFAULT_TERM_SECTIONS[s.id]).join("\n");

export function defaultRetreatType() {
  return {
    id: "rt-retreat",
    name: "The Royal Family Retreat",
    baseRate: 30000,
    extraBed: 0,
    childRate: 0,
    maxGuests: 8,
    extraBeds: 0,
    composition: "4 Deluxe AC",
  };
}

export function defaultRoomTypes() {
  return [
    { id: "rt-suite", name: "Suite room AC", baseRate: 5500, extraBed: 800, childRate: 0, maxGuests: 4, extraBeds: 2 },
    { id: "rt-dlx", name: "Deluxe AC", baseRate: 3500, extraBed: 600, childRate: 0, maxGuests: 4, extraBeds: 2 },
    { id: "rt-std", name: "Standard AC", baseRate: 2500, extraBed: 600, childRate: 0, maxGuests: 4, extraBeds: 2 },
    defaultRetreatType(),
  ];
}

export function defaultRooms() {
  const rooms = [];
  for (let n = 101; n <= 102; n++) {
    rooms.push({ id: `r${n}`, number: String(n), floor: 1, typeId: "rt-suite", status: "Available", hkStatus: "Clean" });
  }
  for (let n = 201; n <= 212; n++) {
    rooms.push({ id: `r${n}`, number: String(n), floor: 2, typeId: "rt-dlx", status: "Available", hkStatus: "Clean" });
  }
  for (let n = 301; n <= 308; n++) {
    rooms.push({ id: `r${n}`, number: String(n), floor: 3, typeId: "rt-std", status: "Available", hkStatus: "Clean" });
  }
  return rooms;
}

export function createSeed() {
  const halls = [
    {
      id: "hall-1",
      name: "Imperial Ballroom",
      code: "IMPERIAL",
      kind: "Indoor",
      tag: "Plenary sessions. Stage, crystal light.",
      jp: "Plenary sessions",
      copy: "A double-height hall for conferences and exhibitions, with crystal light and a full stage.",
      webPhoto: "/site/images/venue-imperial.jpg",
      capacityMin: 1000,
      capacity: 3000,
      floating: 3000,
      dining: 1500,
      ac: true,
      parking: 300,
      kitchen: true,
      stage: true,
      greenRoom: true,
      lift: true,
      powerBackup: true,
      seating: ["Banquet", "Theatre", "U-shape"],
      rates: { halfDay: 300000, fullDay: 450000 },
      setupHours: 4,
      teardownHours: 2,
      bufferMinutes: 60,
      minValue: 300000,
      color: "#8a6a2f",
      photo: "/hall-imperial.png",
      active: true,
    },
    {
      id: "hall-2",
      name: "Garden Pavilion",
      code: "GARDEN",
      kind: "Lawn & covered dining",
      tag: "Outdoor conferences. Covered pavilion.",
      jp: "Outdoor conference",
      copy: "Lawn, fountain court, and a covered pavilion — made for outdoor conferences and exhibitions.",
      webPhoto: "/site/images/venue-garden.jpg",
      capacityMin: 800,
      capacity: 800,
      floating: 800,
      dining: 500,
      ac: false,
      parking: 200,
      kitchen: true,
      stage: true,
      greenRoom: true,
      lift: false,
      powerBackup: true,
      seating: ["Theatre", "Banquet", "Exhibition"],
      rates: { halfDay: 125000, fullDay: 250000 },
      setupHours: 3,
      teardownHours: 2,
      bufferMinutes: 45,
      minValue: 125000,
      color: "#6b5a32",
      photo: "/hall-garden.png",
      active: true,
    },
    {
      id: "hall-3",
      name: "Heritage Courtyard (MINI)",
      code: "HERITAGE",
      kind: "Courtyard",
      tag: "Board meetings. Quiet inner court.",
      jp: "Board meetings",
      copy: "A quieter hall for board meetings and training, with a private inner court.",
      webPhoto: "/site/images/venue-courtyard.jpg",
      capacityMin: 100,
      capacity: 500,
      floating: 500,
      dining: 250,
      ac: true,
      parking: 80,
      kitchen: false,
      stage: true,
      greenRoom: false,
      lift: false,
      powerBackup: true,
      seating: ["Cluster", "U-shape"],
      rates: { halfDay: 125000, fullDay: 200000 },
      setupHours: 2,
      teardownHours: 1,
      bufferMinutes: 30,
      minValue: 125000,
      color: "#5c4a2e",
      photo: "/hall-heritage.png",
      active: true,
    },
  ];

  const roomTypes = defaultRoomTypes();
  const rooms = defaultRooms();

  const services = [];

  const packages = [
    {
      id: "pkg-mandap",
      name: "Workshop Day",
      includes: ["Heritage Courtyard (MINI)", "up to 500 guests", "8-hour hall access"],
      price: 200000,
      minGuests: 100,
      hallId: "hall-3",
    },
    {
      id: "pkg-royal",
      name: "Grand Convention",
      includes: ["Imperial Ballroom", "up to 3,000 guests", "full-day hall"],
      price: 450000,
      minGuests: 1000,
      hallId: "hall-1",
    },
    {
      id: "pkg-garden",
      name: "Outdoor Conference",
      includes: ["Garden Pavilion", "up to 800 guests", "lawn and covered dining"],
      price: 250000,
      minGuests: 200,
      hallId: "hall-2",
    },
  ];

  const pricingRules = [];

  const guests = [];
  const hallReservations = [];
  const roomReservations = [];
  const bookings = [];
  const folioLines = [];
  const folios = [];
  const payments = [];
  const invoices = [];
  const events = [];
  const cateringOrders = [];

  const vendors = [
    { id: "v1", name: "Sri Decor", trade: "Decorator", phone: "9885123401", city: "Rajahmundry", status: "Active" },
    { id: "v2", name: "Lens Craft", trade: "Photographer", phone: "9885123402", city: "Kakinada", status: "Active" },
    { id: "v3", name: "BeatBox", trade: "DJ", phone: "9885123403", city: "Razole", status: "Active" },
    { id: "v4", name: "SecureAP", trade: "Security", phone: "9885123404", city: "Amalapuram", status: "Active" },
    { id: "v5", name: "Annapurna Catering", trade: "Caterer", phone: "9885123405", city: "Palagummi", status: "Active" },
  ];

  const purchaseOrders = [];
  const notifications = [];

  return {
    meta: { version: 2, installedAt: new Date().toISOString() },
    company: {
      id: "co-gayatri",
      name: "Gayatri Hospitality",
      group: "Gayatri Venues",
    },
    property: {
      id: "prop-palagummi",
      name: "Gayatri Convention",
      brandName: "Gayatri",
      tagline: "Convention",
      place: "Palagummi · Konaseema",
      address: [
        "Palagummi Village, Razole Mandal",
        "Dr. B.R.A. Konaseema",
        "Andhra Pradesh 533249",
      ],
      phone: "+91 72043 01779",
      notifyPhone: "+91 72043 01779",
      notifyWhatsApp: true,
      email: "events@gayatrifunctionhall.com",
      desk: "Desk 10:00 – 20:00 · Tours by appointment",
      about: DEFAULT_ABOUT,
      banquetIntro: DEFAULT_BANQUET,
      terms: DEFAULT_TERMS,
      mapLat: 16.4748165,
      mapLng: 81.875945,
      mapQuery: "GAYATRI WATER AND BEVERAGES, Palagummi Village, Razole Mandal, Dr. B.R.A. Konaseema, Andhra Pradesh 533249",
      eventTypes: [...DEFAULT_EVENT_TYPES],
      stories: [],
      timezone: "Asia/Kolkata",
      currency: "INR",
      locale: "en-IN",
      taxName: "GST",
      taxPercent: 18,
      taxInclusive: false,
      gstin: "",
      country: "IN",
      language: "en",
      policies: { ...DEFAULT_POLICIES },
      termSets: defaultTermSets(),
    },
    users: [
      { id: "u-admin", name: "Owner", role: "admin", email: "owner@gayatrifunctionhall.com" },
      { id: "u-mgr", name: "Duty manager", role: "manager", email: "desk@gayatrifunctionhall.com" },
      { id: "u-hk", name: "Housekeeping", role: "housekeeping", email: "hk@gayatrifunctionhall.com" },
    ],
    session: { userId: "u-admin" },
    halls,
    roomTypes,
    rooms,
    services,
    packages,
    pricingRules,
    guests,
    bookings,
    hallReservations,
    roomReservations,
    folios,
    folioLines,
    payments,
    invoices,
    events,
    cateringOrders,
    vendors,
    purchaseOrders,
    notifications,
    documents: [],
    enquiries: [],
    agreements: [],
    expenses: [],
    audit: [],
  };
}
