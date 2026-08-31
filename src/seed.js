import { addDays, todayISO, uid } from "./lib";

const today = todayISO();

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
      "settings.property",
    ],
  },
  frontdesk: {
    label: "Front desk",
    permissions: ["dashboard", "calendar", "rooms", "reservations", "guests", "billing", "documents"],
  },
  housekeeping: {
    label: "Housekeeping",
    permissions: ["dashboard", "rooms", "calendar"],
  },
  accounts: {
    label: "Accounts",
    permissions: ["dashboard", "billing", "reports", "vendors"],
  },
};

export const DEFAULT_EVENT_TYPES = [
  "Wedding",
  "Reception",
  "Sangeet / Mehendi",
  "Engagement",
  "Nikaah / Walima",
  "Birthday / Family function",
  "Corporate",
];

export const DEFAULT_STORIES = [
  {
    quote:
      "The Imperial Ballroom held 1,100 guests without feeling crowded. Our elders had a lounge, and the team stayed till the last car left.",
    cite: "Ananya & Rohan Mehta — Reception",
  },
  {
    quote: "We wanted a garden phera and a covered dinner. Gayatri gave us both, plus a rain plan we never needed.",
    cite: "Fatima & Zayan Khan — Nikaah & Walima",
  },
  {
    quote: "From sangeet to reception, one estate, three spaces. We would book again for a family function.",
    cite: "The Reddy Family — Three-day wedding",
  },
];

export const DEFAULT_ABOUT =
  "Host your private event at Gayatri and impress your guests from our garden lawns and grand halls in Palagummi Village, Razole. From elegant weddings and welcome parties to intimate celebrations, our spaces adapt to every occasion. With personal planning, we turn special days into memories.";

export const DEFAULT_BANQUET =
  "Choose a hall package for your wedding, reception, or family function. Gayatri provides the venue — catering, decoration, DJ, and photography are arranged by you.";

export const DEFAULT_TERMS = [
  "A booking is confirmed only after Gayatri Function Hall receives the agreed advance and issues a receipt.",
  "The booking is for hall hire and guest rooms only. Catering, decoration, DJ, photography, mandap florist and similar services are arranged and paid by the guest.",
  "The remaining balance must be paid before the function starts. GST is extra if applicable.",
  "Advance is not refundable if the guest cancels. A date change is possible only if the new date is free, at the desk's discretion.",
  "Hall timing includes setup and clearing as written on the booking. Extra hours are charged if the hall is not vacated on time.",
  "Room rent is charged per night. An extra bed is billed if a child or guest needs one. Children are not billed a separate child fee.",
  "The guest is responsible for all attendees and for any damage to the hall, rooms, furniture, lights or garden. Repair cost will be added to the bill.",
  "Music, loudspeakers and fireworks must follow local rules and the time limit given by the desk.",
  "Vehicles park at the owner's risk. Gayatri is not responsible for loss of valuables.",
  "Electricity, generator (if provided) and water are as available on the day. The desk will help with a backup plan where possible.",
  "The guest must show identification at the desk. Room check-in needs ID as required by law.",
  "Gayatri may refuse or stop an event that is illegal, unsafe, or against these terms.",
].join("\n");

export function termsLines(property) {
  return String(property?.terms || DEFAULT_TERMS)
    .split(/\n+/)
    .map((line) => line.replace(/^\s*\d+[.)]\s*/, "").trim())
    .filter(Boolean);
}

export function createSeed() {
  const halls = [
    {
      id: "hall-1",
      name: "Imperial Ballroom",
      code: "IMPERIAL",
      kind: "Indoor",
      tag: "Grand receptions. Stage, crystal light.",
      jp: "Grand receptions",
      copy: "A double-height hall for large receptions, with crystal light and a full stage.",
      webPhoto: "/site/images/venue-imperial.jpg",
      capacity: 1500,
      floating: 1800,
      dining: 900,
      ac: true,
      parking: 300,
      kitchen: true,
      stage: true,
      greenRoom: true,
      lift: true,
      powerBackup: true,
      seating: ["Banquet", "Theatre", "U-shape"],
      rates: { hourly: 45000, halfDay: 320000, fullDay: 550000 },
      setupHours: 4,
      teardownHours: 2,
      bufferMinutes: 60,
      minValue: 280000,
      color: "#8a6a2f",
      photo: "/hall-imperial.png",
      active: true,
    },
    {
      id: "hall-2",
      name: "Garden Pavilion",
      code: "GARDEN",
      kind: "Lawn & covered dining",
      tag: "Lawn, fountain court, covered mandap.",
      jp: "Open-air evenings",
      copy: "Lawn, fountain court, and a covered mandap — made for pheras at golden hour.",
      webPhoto: "/site/images/venue-garden.jpg",
      capacity: 800,
      floating: 1000,
      dining: 500,
      ac: false,
      parking: 200,
      kitchen: true,
      stage: true,
      greenRoom: true,
      lift: false,
      powerBackup: true,
      seating: ["Outdoor aisle", "Banquet", "Mandap"],
      rates: { hourly: 28000, halfDay: 220000, fullDay: 380000 },
      setupHours: 3,
      teardownHours: 2,
      bufferMinutes: 45,
      minValue: 180000,
      color: "#6b5a32",
      photo: "/hall-garden.png",
      active: true,
    },
    {
      id: "hall-3",
      name: "Heritage Courtyard",
      code: "HERITAGE",
      kind: "Courtyard",
      tag: "Intimate nikaah, engagement, family dinners.",
      jp: "Intimate functions",
      copy: "A warmer private hall for nikaah, engagement, and family dinners.",
      webPhoto: "/site/images/venue-courtyard.jpg",
      capacity: 280,
      floating: 350,
      dining: 180,
      ac: true,
      parking: 80,
      kitchen: false,
      stage: true,
      greenRoom: false,
      lift: false,
      powerBackup: true,
      seating: ["Cluster", "Family banquet"],
      rates: { hourly: 16000, halfDay: 180000, fullDay: 250000 },
      setupHours: 2,
      teardownHours: 1,
      bufferMinutes: 30,
      minValue: 120000,
      color: "#5c4a2e",
      photo: "/hall-heritage.png",
      active: true,
    },
  ];

  const roomTypes = [
    { id: "rt-dlx", name: "Deluxe AC", baseRate: 4500, extraBed: 800, childRate: 1500, maxGuests: 3 },
    { id: "rt-std", name: "Standard AC", baseRate: 3200, extraBed: 600, childRate: 1000, maxGuests: 3 },
    { id: "rt-nac", name: "Non-AC", baseRate: 1800, extraBed: 400, childRate: 700, maxGuests: 2 },
  ];

  const rooms = [
    { id: "r101", number: "101", floor: 1, typeId: "rt-dlx", status: "Occupied" },
    { id: "r102", number: "102", floor: 1, typeId: "rt-dlx", status: "Reserved" },
    { id: "r201", number: "201", floor: 2, typeId: "rt-std", status: "Available" },
    { id: "r202", number: "202", floor: 2, typeId: "rt-std", status: "Dirty" },
    { id: "r203", number: "203", floor: 2, typeId: "rt-std", status: "Cleaning" },
    { id: "r204", number: "204", floor: 2, typeId: "rt-std", status: "Inspected" },
    { id: "r205", number: "205", floor: 2, typeId: "rt-std", status: "Available" },
    { id: "r206", number: "206", floor: 2, typeId: "rt-std", status: "Available" },
    { id: "r301", number: "301", floor: 3, typeId: "rt-nac", status: "Available" },
    { id: "r302", number: "302", floor: 3, typeId: "rt-nac", status: "Maintenance" },
  ];

  const services = [];

  const packages = [
    {
      id: "pkg-mandap",
      name: "Mandap Evening",
      includes: ["Heritage Courtyard", "up to 280 guests", "8-hour hall access"],
      price: 280000,
      minGuests: 80,
      hallId: "hall-3",
    },
    {
      id: "pkg-royal",
      name: "Royal Wedding",
      includes: ["Imperial Ballroom", "up to 1,500 guests", "full-day hall"],
      price: 850000,
      minGuests: 400,
      hallId: "hall-1",
    },
    {
      id: "pkg-garden",
      name: "Garden Celebration",
      includes: ["Garden Pavilion", "up to 800 guests", "lawn and covered dining"],
      price: 540000,
      minGuests: 200,
      hallId: "hall-2",
    },
  ];

  const pricingRules = [
    { id: "pr-weekend", name: "Weekend", type: "weekend", percent: 15, days: [0, 6] },
    { id: "pr-peak", name: "Wedding peak (Dec–Feb)", type: "season", percent: 20, from: "2026-12-01", to: "2027-02-15" },
    { id: "pr-off", name: "Off-peak monsoon", type: "season", percent: -10, from: "2026-07-01", to: "2026-09-15" },
  ];

  const guests = [
    {
      id: "g-kumar",
      name: "Ramesh Kumar",
      phone: "9849600556",
      email: "kumar@example.com",
      nationality: "India",
      idProof: { type: "Aadhaar", number: "XXXX-XXXX-1021" },
      address: "Razole, Konaseema",
      company: "",
      emergency: "Lakshmi Kumar · 9849600557",
      preferences: "Vegetarian buffet, first-floor rooms",
      tags: ["Wedding", "Repeat"],
    },
    {
      id: "g-walkin",
      name: "Srinivas Rao",
      phone: "9876543210",
      email: "",
      nationality: "India",
      idProof: { type: "PAN", number: "XXXXX1234X" },
      address: "Palagummi",
      company: "",
      emergency: "",
      preferences: "",
      tags: ["Walk-in"],
    },
  ];

  const bookingId = "bk_seed_wedding";
  const folioId = "fo_seed_wedding";

  const hallReservations = [
    {
      id: "hr-1",
      bookingId,
      hallId: "hall-1",
      date: addDays(today, 12),
      slotType: "full-day",
      start: `${addDays(today, 12)}T06:00`,
      end: `${addDays(today, 13)}T06:00`,
      setupHours: 4,
      teardownHours: 2,
      status: "Confirmed",
    },
    {
      id: "hr-2",
      bookingId: "bk_seed_mini",
      hallId: "hall-3",
      date: addDays(today, 2),
      slotType: "half-day",
      start: `${addDays(today, 2)}T18:00`,
      end: `${addDays(today, 3)}T00:00`,
      setupHours: 2,
      teardownHours: 1,
      status: "Confirmed",
    },
  ];

  const roomReservations = [
    {
      id: "rr-1",
      bookingId,
      roomId: "r101",
      guestId: "g-kumar",
      checkIn: today,
      checkOut: addDays(today, 2),
      adults: 2,
      children: 1,
      extraBed: 1,
      status: "Occupied",
      source: "Group",
    },
    {
      id: "rr-2",
      bookingId,
      roomId: "r102",
      guestId: "g-kumar",
      checkIn: addDays(today, 1),
      checkOut: addDays(today, 3),
      adults: 2,
      children: 0,
      extraBed: 0,
      status: "Reserved",
      source: "Group",
    },
    {
      id: "rr-3",
      bookingId: "bk_walkin",
      roomId: "r204",
      guestId: "g-walkin",
      checkIn: addDays(today, -1),
      checkOut: today,
      adults: 1,
      children: 0,
      extraBed: 0,
      status: "Checked out",
      source: "Walk-in",
    },
  ];

  const bookings = [
    {
      id: bookingId,
      number: "BK-2026-00012",
      guestId: "g-kumar",
      type: "Wedding",
      source: "Direct",
      status: "Confirmed",
      eventDate: addDays(today, 12),
      guestsExpected: 800,
      packageId: "pkg-royal",
      notes: "Mandap facing east. Generator on standby.",
      createdAt: `${addDays(today, -18)}T10:12:00`,
    },
    {
      id: "bk_seed_mini",
      number: "BK-2026-00018",
      guestId: "g-walkin",
      type: "Birthday",
      source: "Walk-in",
      status: "Confirmed",
      eventDate: addDays(today, 2),
      guestsExpected: 180,
      packageId: "pkg-mandap",
      notes: "",
      createdAt: `${addDays(today, -3)}T16:40:00`,
    },
    {
      id: "bk_walkin",
      number: "BK-2026-00009",
      guestId: "g-walkin",
      type: "Room only",
      source: "Walk-in",
      status: "Checked out",
      eventDate: addDays(today, -1),
      guestsExpected: 1,
      packageId: "",
      notes: "",
      createdAt: `${addDays(today, -1)}T14:05:00`,
    },
    {
      id: "bk_enq",
      number: "ENQ-2026-00004",
      guestId: "g-kumar",
      type: "Reception",
      source: "Website",
      status: "Enquiry",
      eventDate: addDays(today, 40),
      guestsExpected: 400,
      packageId: "",
      notes: "Need quotation for Garden Pavilion + 6 rooms",
      createdAt: `${today}T09:20:00`,
    },
  ];

  const folioLines = [
    { id: uid("ln"), folioId, category: "hall", description: "Imperial Ballroom · full day × 1", qty: 1, unitPrice: 550000, amount: 550000 },
    { id: uid("ln"), folioId, category: "room", description: "Deluxe AC 101–102 · 2 nights", qty: 4, unitPrice: 4500, amount: 18000 },
    { id: uid("ln"), folioId, category: "catering", description: "Buffet 800 plates @ ₹650", qty: 800, unitPrice: 650, amount: 520000 },
    { id: uid("ln"), folioId, category: "decoration", description: "Stage & decoration", qty: 1, unitPrice: 60000, amount: 60000 },
    { id: uid("ln"), folioId, category: "photography", description: "Photography", qty: 1, unitPrice: 35000, amount: 35000 },
  ];

  const folios = [
    {
      id: folioId,
      bookingId,
      discount: 25000,
      taxPercent: 18,
      status: "Open",
    },
  ];

  const payments = [
    {
      id: "pay-1",
      folioId,
      bookingId,
      amount: 150000,
      method: "UPI",
      type: "Advance",
      at: `${addDays(today, -10)}T11:00:00`,
      ref: "UPI/AXIS/8821",
    },
  ];

  const invoices = [
    {
      id: "inv-1",
      number: "QT-2026-00012",
      type: "Quotation",
      bookingId,
      folioId,
      at: `${addDays(today, -18)}T10:30:00`,
      status: "Accepted",
    },
    {
      id: "inv-2",
      number: "AR-2026-00012",
      type: "Advance receipt",
      bookingId,
      folioId,
      at: `${addDays(today, -10)}T11:00:00`,
      status: "Issued",
    },
  ];

  const events = [
    {
      id: "ev-1",
      bookingId,
      name: "Kumar wedding",
      date: addDays(today, 12),
      tasks: [
        { id: "t1", name: "Hall", status: "Done", assignee: "Front desk" },
        { id: "t2", name: "Rooms", status: "Done", assignee: "Front desk" },
        { id: "t3", name: "Catering", status: "Done", assignee: "Kitchen" },
        { id: "t4", name: "Decoration", status: "In progress", assignee: "Sri Decor" },
        { id: "t5", name: "Photography", status: "Done", assignee: "Lens Craft" },
        { id: "t6", name: "DJ", status: "Pending", assignee: "BeatBox" },
        { id: "t7", name: "Parking", status: "Done", assignee: "Security" },
        { id: "t8", name: "Security", status: "Done", assignee: "SecureAP" },
        { id: "t9", name: "Stage", status: "Done", assignee: "Sri Decor" },
      ],
    },
  ];

  const cateringOrders = [
    {
      id: "cat-1",
      bookingId,
      meal: "Lunch + dinner buffet",
      expectedGuests: 800,
      platesOrdered: 850,
      platesServed: 0,
      wastage: 0,
      costPerPlate: 420,
      sellPerPlate: 650,
      menus: ["Welcome drinks", "Lunch buffet", "Dinner buffet", "Live dosa counter"],
    },
  ];

  const vendors = [
    { id: "v1", name: "Sri Decor", trade: "Decorator", phone: "9885123401", city: "Rajahmundry", status: "Active" },
    { id: "v2", name: "Lens Craft", trade: "Photographer", phone: "9885123402", city: "Kakinada", status: "Active" },
    { id: "v3", name: "BeatBox", trade: "DJ", phone: "9885123403", city: "Razole", status: "Active" },
    { id: "v4", name: "SecureAP", trade: "Security", phone: "9885123404", city: "Amalapuram", status: "Active" },
    { id: "v5", name: "Annapurna Catering", trade: "Caterer", phone: "9885123405", city: "Palagummi", status: "Active" },
  ];

  const purchaseOrders = [
    {
      id: "po-1",
      number: "PO-2026-00008",
      vendorId: "v1",
      bookingId,
      service: "Stage & floral decor",
      amount: 48000,
      status: "Confirmed",
      at: `${addDays(today, -7)}T12:00:00`,
    },
  ];

  const notifications = [
    { id: "n1", at: `${today}T08:00:00`, channel: "In-app", title: "Check-out due", body: "Room 204 · Srinivas Rao" },
    { id: "n2", at: `${today}T09:20:00`, channel: "In-app", title: "New website enquiry", body: "Reception · 40 days out · Kumar" },
    { id: "n3", at: `${addDays(today, -1)}T18:00:00`, channel: "WhatsApp", title: "Balance reminder", body: "BK-2026-00012 balance due" },
  ];

  return {
    meta: { version: 2, installedAt: new Date().toISOString() },
    company: {
      id: "co-gayatri",
      name: "Gayatri Hospitality",
      group: "Gayatri Venues",
    },
    property: {
      id: "prop-palagummi",
      name: "Gayatri Function Hall",
      brandName: "Gayatri",
      tagline: "Marriage & Function Hall",
      place: "Palagummi · Konaseema",
      address: [
        "Palagummi Village, Razole Mandal",
        "Dr. B.R.A. Konaseema",
        "Andhra Pradesh 533249",
      ],
      phone: "+91 98496 00555",
      notifyPhone: "+91 98496 00555",
      notifyWhatsApp: true,
      email: "events@gayatrifunctionhall.com",
      desk: "Desk 10:00 – 20:00 · Tours by appointment",
      about:
        "Host your private event at Gayatri and impress your guests from our garden lawns and grand halls in Palagummi Village, Razole. From elegant weddings and welcome parties to intimate celebrations, our spaces adapt to every occasion. With personal planning, we turn special days into memories.",
      banquetIntro:
        "Choose a hall package for your wedding, reception, or family function. Gayatri provides the venue — catering, decoration, DJ, and photography are arranged by you.",
      terms: DEFAULT_TERMS,
      mapQuery: "Palagummi Village Razole Mandal Dr B.R.A. Konaseema Andhra Pradesh 533249",
      eventTypes: [
        "Wedding",
        "Reception",
        "Sangeet / Mehendi",
        "Engagement",
        "Nikaah / Walima",
        "Birthday / Family function",
        "Corporate",
      ],
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
    enquiries: [
      {
        id: "en-1",
        bookingId: "bk_enq",
        name: "Ramesh Kumar",
        phone: "9849600556",
        date: addDays(today, 40),
        hall: "Garden Pavilion",
        guests: 400,
        message: "Need quotation for Garden Pavilion + 6 rooms",
        status: "Open",
      },
    ],
    audit: [
      {
        id: "a1",
        at: `${addDays(today, -10)}T11:00:00`,
        user: "Duty manager",
        action: "Payment recorded",
        entity: "BK-2026-00012",
        detail: "Advance ₹1,50,000 UPI",
      },
    ],
  };
}
