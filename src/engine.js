import { addDays, addHours, inRange, isWeekend, nightsBetween, overlaps, startOfMonthISO, uid } from "./lib";

export function blockedWindow(res) {
  const setup = Number(res.setupHours) || 0;
  const tear = Number(res.teardownHours) || 0;
  const start = addHours(res.start, -setup);
  const end = addHours(res.end, tear);
  return { start, end };
}

export function hallOccupiesDate(res, iso) {
  if (!res || res.status === "Cancelled") return false;
  const { start, end } = blockedWindow(res);
  return overlaps(`${iso}T00:00`, `${iso}T23:59`, start, end);
}

export function formatClock(iso) {
  if (!iso || !String(iso).includes("T")) return iso || "";
  const time = String(iso).split("T")[1] || "";
  const [hh, mm] = time.split(":");
  const h = Number(hh);
  if (Number.isNaN(h)) return iso;
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${(mm || "00").slice(0, 2)} ${ampm}`;
}

export function hallDayStatus(state, hallId, date) {
  const hall = state.halls.find((h) => h.id === hallId);
  const holds = (state.hallReservations || []).filter(
    (r) => r.hallId === hallId && r.status !== "Cancelled" && hallOccupiesDate(r, date)
  );
  const slots = holds.map((r) => {
    const booking = state.bookings.find((b) => b.id === r.bookingId);
    const guest = state.guests.find((g) => g.id === booking?.guestId);
    const source = originLabel(booking?.source);
    return {
      hallId,
      hallName: hall?.name || "",
      slotType: r.slotType || "full-day",
      start: r.start,
      end: r.end,
      startLabel: formatClock(r.start),
      endLabel: formatClock(r.end),
      windowLabel: `${formatClock(r.start)} – ${
        String(r.end).slice(0, 10) !== String(r.start).slice(0, 10) ? "next day " : ""
      }${formatClock(r.end)}`,
      status: booking?.status || r.status,
      source,
      guestName: guest?.name || "",
      number: booking?.number || "",
      confirmed: booking?.status === "Confirmed" || r.status === "Confirmed",
    };
  });
  const pending = (state.enquiries || []).filter(
    (e) => e.status === "Open" && e.date === date && (!hall || e.hall === hall.name || e.hall === "Any available")
  );
  return {
    booked: slots.length > 0,
    slots,
    pendingEnquiries: pending.length,
  };
}

export function originLabel(source) {
  if (source === "Website") return "Customer website";
  return source || "Hall desk";
}

export function publicAvailability(state, hallName, date) {
  const specific = Boolean(hallName && hallName !== "Any available");
  const halls = specific ? state.halls.filter((h) => h.name === hallName) : state.halls;
  const rows = halls.map((h) => {
    const st = hallDayStatus(state, h.id, date);
    return {
      hallName: h.name,
      booked: st.booked,
      windows: st.slots.map((s) => ({
        slotType: s.slotType,
        startLabel: s.startLabel,
        endLabel: s.endLabel,
        windowLabel: s.windowLabel,
      })),
    };
  });
  const allBooked = rows.length > 0 && rows.every((r) => r.booked);
  const anyBooked = rows.some((r) => r.booked);
  const blocked = specific ? anyBooked : allBooked;
  let message = "";
  if (blocked && specific && rows[0]) {
    const w = rows[0].windows[0];
    message = w
      ? `${rows[0].hallName} is already booked on this date: ${w.windowLabel || `${w.startLabel} – ${w.endLabel}`} (${w.slotType}). Choose another date or hall.`
      : `${rows[0].hallName} is already booked on this date.`;
  } else if (blocked) {
    message = `All halls are booked on ${date}. Please choose another date.`;
  }
  return { rows, allBooked, anyBooked, blocked, message };
}

export function roomOccupiesDate(res, iso) {
  if (!res || ["Cancelled", "Checked out"].includes(res.status)) return false;
  return iso >= res.checkIn && iso < res.checkOut;
}

export function hallClash(reservations, hallId, start, end, ignoreId) {
  return reservations.find((r) => {
    if (r.id === ignoreId || r.status === "Cancelled") return false;
    if (r.hallId !== hallId) return false;
    const a = blockedWindow(r);
    return overlaps(start, end, a.start, a.end);
  });
}

export function roomClash(reservations, roomId, checkIn, checkOut, ignoreId) {
  return reservations.find((r) => {
    if (r.id === ignoreId) return false;
    if (["Cancelled", "Checked out"].includes(r.status)) return false;
    if (r.roomId !== roomId) return false;
    return overlaps(checkIn, checkOut, r.checkIn, r.checkOut);
  });
}

export function applyPricing(base, date, rules) {
  let pct = 0;
  for (const rule of rules || []) {
    if (rule.type === "weekend" && isWeekend(date)) pct += rule.percent;
    if (rule.type === "season" && inRange(date, rule.from, rule.to)) pct += rule.percent;
  }
  return Math.round(base * (1 + pct / 100));
}

export function hallRate(hall, slotType, date, rules) {
  const rates = hall.rates || {};
  const base =
    slotType === "half-day"
      ? rates.halfDay
      : slotType === "hourly"
        ? rates.halfDay
        : rates.fullDay;
  return applyPricing(base || rates.fullDay, date, rules);
}

export function folioTotals(folio, lines, payments, taxPercent) {
  const subtotal = lines.reduce((s, l) => s + Number(l.amount || 0), 0);
  const discount = Number(folio?.discount || 0);
  const taxable = Math.max(0, subtotal - discount);
  const tax = Math.round((taxable * (taxPercent ?? 0)) / 100);
  const total = taxable + tax;
  const paid = payments.reduce((s, p) => {
    if (p.type === "Deposit" || p.type === "Deposit return") return s;
    return s + (p.type === "Refund" ? -Number(p.amount) : Number(p.amount));
  }, 0);
  const deposit = payments.reduce((s, p) => {
    if (p.type === "Deposit") return s + Number(p.amount || 0);
    if (p.type === "Deposit return") return s - Number(p.amount || 0);
    return s;
  }, 0);
  const balance = total - paid;
  return { subtotal, discount, tax, total, paid, balance, deposit };
}

export function bookingFolio(state, bookingId) {
  const folio = state.folios.find((f) => f.bookingId === bookingId);
  const lines = state.folioLines.filter((l) => l.folioId === folio?.id);
  const pays = state.payments.filter((p) => p.folioId === folio?.id);
  const tax = state.property.taxPercent;
  return { folio, lines, pays, totals: folio ? folioTotals(folio, lines, pays, tax) : emptyTotals() };
}

function emptyTotals() {
  return { subtotal: 0, discount: 0, tax: 0, total: 0, paid: 0, balance: 0, deposit: 0 };
}

export function occupancyStats(state, date) {
  const liveRooms = state.rooms.filter((r) => !["Out of order", "Maintenance"].includes(occupancyOfSafe(r)));
  const occupied = new Set(
    (state.roomReservations || [])
      .filter((r) => roomOccupiesDate(r, date))
      .map((r) => r.roomId)
  ).size;
  const occPct = liveRooms.length ? Math.round((occupied / liveRooms.length) * 100) : 0;
  const hallBooked = state.halls.filter((h) =>
    state.hallReservations.some((r) => r.hallId === h.id && hallOccupiesDate(r, date))
  ).length;
  const hallPct = Math.round((hallBooked / Math.max(1, state.halls.length)) * 100);
  return { occupied, live: liveRooms.length, occPct, hallBooked, hallPct };
}

function occupancyOfSafe(room) {
  return ["Available", "Reserved", "Occupied", "Out of order", "Maintenance"].includes(room?.status)
    ? room.status
    : "Available";
}

export function hotelKpis(state, date) {
  const occ = occupancyStats(state, date);
  const start = startOfMonthISO(new Date(`${date}T12:00:00`));
  let roomNights = 0;
  let cursor = start;
  while (cursor <= date) {
    roomNights += occupancyStats(state, cursor).occupied;
    cursor = addDays(cursor, 1);
  }
  const days = Math.max(1, nightsBetween(start, addDays(date, 1)) || 1);
  const roomRev = (state.folioLines || [])
    .filter((l) => String(l.category || "") === "room")
    .filter((l) => {
      const folio = (state.folios || []).find((f) => f.id === l.folioId);
      const bk = (state.bookings || []).find((b) => b.id === folio?.bookingId);
      return bk && !["Cancelled", "Refunded"].includes(bk.status);
    })
    .reduce((s, l) => s + Number(l.amount || 0), 0);
  const adr = roomNights ? Math.round(roomRev / roomNights) : 0;
  const revpar = occ.live && days ? Math.round(roomRev / (occ.live * days)) : 0;
  return { ...occ, adr, revpar, roomNights, roomRev, days };
}

function payDay(p) {
  return String(p.at || p.date || "").slice(0, 10);
}

export function railOf(method) {
  const m = String(method || "").toLowerCase();
  if (m.includes("cash")) return "cash";
  if (m.includes("upi")) return "upi";
  return "other";
}

export function lineKind(line) {
  return String(line?.category || "") === "room" ? "room" : "function";
}

export function kindSplit(lines, moneyMap = {}) {
  const list = lines || [];
  const roomAmt = list.filter((l) => lineKind(l) === "room").reduce((s, l) => s + Number(l.amount || 0), 0);
  const functionAmt = list.filter((l) => lineKind(l) !== "room").reduce((s, l) => s + Number(l.amount || 0), 0);
  const sub = roomAmt + functionAmt;
  const roomShare = sub ? roomAmt / sub : 0;
  const functionShare = sub ? functionAmt / sub : 1;
  const take = (n, share) => Math.round((Number(n) || 0) * share);
  const slice = (share) => {
    const out = {};
    for (const [k, v] of Object.entries(moneyMap)) out[k] = take(v, share);
    return out;
  };
  return {
    kind: roomAmt && functionAmt ? "mixed" : roomAmt ? "room" : "function",
    roomAmt,
    functionAmt,
    roomShare,
    functionShare,
    room: slice(roomShare),
    function: slice(functionShare),
  };
}

function sumBucket(rows, bucket, field) {
  return rows.reduce((s, r) => s + Number(r[bucket]?.[field] || 0), 0);
}

function bucketTotals(rows, bucket) {
  return {
    cash: sumBucket(rows, bucket, "cash"),
    upi: sumBucket(rows, bucket, "upi"),
    other: sumBucket(rows, bucket, "other"),
    advance: sumBucket(rows, bucket, "advance"),
    total: sumBucket(rows, bucket, "total"),
    paid: sumBucket(rows, bucket, "paid"),
    balance: sumBucket(rows, bucket, "balance"),
    received: sumBucket(rows, bucket, "received"),
  };
}

export function collectionsReport(state, from, to) {
  const inPeriod = (iso) => {
    const d = String(iso || "").slice(0, 10);
    if (!d) return false;
    if (from && to) return inRange(d, from, to);
    if (from) return d >= from;
    if (to) return d <= to;
    return true;
  };
  const sumRail = (list, rail) =>
    (list || [])
      .filter((p) => railOf(p.method) === rail)
      .reduce((s, p) => s + (Number(p.amount) || 0), 0);

  const rows = [];
  for (const b of state.bookings || []) {
    if (b.status === "Cancelled") continue;
    const { lines, pays, totals } = bookingFolio(state, b.id);
    const live = (pays || []).filter((p) => p.type !== "Refund");
    const period = live.filter((p) => inPeriod(payDay(p)));
    if ((from || to) && !period.length && !inPeriod(b.eventDate)) continue;
    const guest = state.guests.find((g) => g.id === b.guestId);
    const cashRow = sumRail(period, "cash");
    const upiRow = sumRail(period, "upi");
    const otherRow = sumRail(period, "other");
    const advanceRow = live.filter((p) => p.type === "Advance").reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const split = kindSplit(lines, {
      cash: cashRow,
      upi: upiRow,
      other: otherRow,
      received: cashRow + upiRow + otherRow,
      advance: advanceRow,
      total: totals.total || 0,
      paid: totals.paid || 0,
      balance: Math.max(0, totals.balance || 0),
    });
    rows.push({
      id: b.id,
      number: b.number,
      name: guest?.name || "Guest",
      phone: guest?.phone || "",
      gstin: guest?.gstin || "",
      date: b.eventDate,
      type: b.type,
      kind: split.kind,
      function: split.function,
      room: split.room,
      cash: cashRow,
      upi: upiRow,
      other: otherRow,
      received: cashRow + upiRow + otherRow,
      advance: advanceRow,
      total: totals.total || 0,
      paid: totals.paid || 0,
      balance: Math.max(0, totals.balance || 0),
    });
  }
  rows.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  const cash = rows.reduce((s, r) => s + r.cash, 0);
  const upi = rows.reduce((s, r) => s + r.upi, 0);
  const other = rows.reduce((s, r) => s + r.other, 0);
  const advance = rows.reduce((s, r) => s + r.advance, 0);
  const balance = rows.reduce((s, r) => s + r.balance, 0);
  return {
    cash,
    upi,
    other,
    advance,
    received: cash + upi + other,
    balance,
    rows,
    from,
    to,
    function: bucketTotals(rows, "function"),
    room: bucketTotals(rows, "room"),
  };
}

export function revenueBreakdown(state) {
  const cats = {};
  for (const line of state.folioLines) {
    cats[line.category] = (cats[line.category] || 0) + Number(line.amount || 0);
  }
  const hall = cats.hall || 0;
  const room = cats.room || 0;
  const food = (cats.food || 0) + (cats.catering || 0);
  const other = Object.entries(cats).reduce((s, [k, v]) => (["hall", "room", "food", "catering"].includes(k) ? s : s + v), 0);
  const gross = hall + room + food + other;
  return { hall, room, food, other, gross, cats };
}

export function askAssistant(state, question) {
  const q = question.toLowerCase();
  const rev = revenueBreakdown(state);
  const cur = state.property.currency;
  const { money } = requireMoney(state);

  if (q.includes("revenue") && (q.includes("hall") || q.includes("highest"))) {
    const top = Object.entries(rev.cats).sort((a, b) => b[1] - a[1])[0];
    return top ? `Highest line is ${top[0]} at ${money(top[1])}. Hall revenue is ${money(rev.hall)}.` : "No folio lines yet.";
  }
  if (q.includes("revenue")) {
    return `Gross folio revenue is ${money(rev.gross)} — halls ${money(rev.hall)}, rooms ${money(rev.room)}, food ${money(rev.food)}, other ${money(rev.other)}.`;
  }
  if (q.includes("unpaid") || q.includes("outstanding") || q.includes("balance")) {
    const rows = state.bookings
      .map((b) => ({ b, ...bookingFolio(state, b.id) }))
      .filter((x) => x.totals.balance > 0 && x.b.status !== "Cancelled");
    const big = rows.filter((x) => x.totals.balance >= 100000);
    const sum = rows.reduce((s, x) => s + x.totals.balance, 0);
    return `${rows.length} open balances totaling ${money(sum)}. ${big.length} booking(s) above ₹1 lakh.`;
  }
  if (q.includes("available") && q.includes("room")) {
    const n = state.rooms.filter((r) => r.status === "Available").length;
    return `${n} of ${state.rooms.length} rooms are ready to sell (Available / Inspected).`;
  }
  if (q.includes("weekend") || q.includes("this week")) {
    const halls = state.hallReservations.filter((r) => r.status === "Confirmed");
    return `${halls.length} confirmed hall hold(s) on the book. Open Calendar for the week grid.`;
  }
  if (q.includes("event") || q.includes("upcoming")) {
    const n = state.bookings.filter((b) => ["Confirmed", "Enquiry", "Quoted"].includes(b.status)).length;
    return `${n} live enquiries / confirmed events. Next: check Events and Calendar.`;
  }
  return `I can answer revenue, unpaid bookings, room availability, and upcoming events for ${state.property.name} (${cur}). Try: “Show unpaid bookings above ₹1 lakh.”`;
}

function requireMoney(state) {
  return {
    money: (n) => {
      try {
        return new Intl.NumberFormat(state.property.locale, {
          style: "currency",
          currency: state.property.currency,
          maximumFractionDigits: 0,
        }).format(n);
      } catch {
        return String(n);
      }
    },
  };
}

export function buildFolioLinesFromDraft(state, draft) {
  const lines = [];
  for (const h of draft.halls || []) {
    const hall = state.halls.find((x) => x.id === h.hallId);
    if (!hall) continue;
    const rate = hallRate(hall, h.slotType, h.date, state.pricingRules);
    const amount = Math.max(hall.minValue, rate);
    lines.push({
      id: uid("ln"),
      category: "hall",
      description: `${hall.name} · ${h.slotType} · ${h.date}`,
      qty: 1,
      unitPrice: amount,
      amount,
    });
  }
  for (const r of draft.rooms || []) {
    const room = state.rooms.find((x) => x.id === r.roomId);
    const type = state.roomTypes.find((t) => t.id === room?.typeId);
    const nights = nightsBetween(r.checkIn, r.checkOut);
    const extra = (r.extraBed || 0) * (type?.extraBed || 0) * nights;
    const base = (type?.baseRate || 0) * nights;
    const amount = applyPricing(base, r.checkIn, state.pricingRules) + extra;
    lines.push({
      id: uid("ln"),
      category: "room",
      description: `Room ${room?.number} (${type?.name}) · ${nights} night(s)`,
      qty: nights,
      unitPrice: type?.baseRate || 0,
      amount,
    });
  }
  for (const s of draft.services || []) {
    if (!s.qty) continue;
    const svc = state.services.find((x) => x.id === s.id);
    if (!svc) continue;
    lines.push({
      id: uid("ln"),
      category: svc.category,
      description: svc.name,
      qty: s.qty,
      unitPrice: svc.price,
      amount: svc.price * s.qty,
    });
  }
  return lines;
}
