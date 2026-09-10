import { useMemo, useState } from "react";
import { bookingFolio, cashbookReport, hallOccupiesDate, occupancyStats, roomOccupiesDate } from "../engine";
import { addDays, formatDate, money, parseISO, startOfMonthISO, todayISO } from "../lib";
import { PageHead } from "../ui";

function endOfMonthISO(iso) {
  const d = parseISO(iso);
  return todayISO(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

function monthsAgoISO(iso, months) {
  const d = parseISO(iso);
  d.setMonth(d.getMonth() - months);
  return startOfMonthISO(d);
}

function monthLabel(iso) {
  return parseISO(iso).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function monthShort(iso) {
  return parseISO(iso).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

function isActiveBooking(b) {
  return b && !["Cancelled", "Refunded"].includes(b.status);
}

function bookingDay(b) {
  return String(b?.eventDate || b?.checkIn || "").slice(0, 10);
}

function buildMonthCells(monthStartISO) {
  const start = parseISO(monthStartISO);
  const y = start.getFullYear();
  const m = start.getMonth();
  const firstDow = (start.getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) {
    cells.push(todayISO(new Date(y, m, d)));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/** Always-visible month calendar in the dashboard filter row. */
function MonthCalendarInline({ monthValue, selectedDate, onSelectDate, onSelectMonth, today, bookedDays }) {
  const viewMonth = `${monthValue}-01`;
  const cells = useMemo(() => buildMonthCells(viewMonth), [viewMonth]);
  const viewLabel = monthLabel(viewMonth);
  const booked = bookedDays || new Set();

  function shiftMonth(delta) {
    const d = parseISO(viewMonth);
    const next = startOfMonthISO(new Date(d.getFullYear(), d.getMonth() + delta, 1));
    onSelectMonth(next.slice(0, 7), next);
  }

  return (
    <div className="dash-month-cal dash-month-cal-inline" aria-label="Month calendar">
      <div className="dash-month-cal-nav">
        <button type="button" className="btn ghost small" onClick={() => shiftMonth(-1)} aria-label="Previous month">
          ‹
        </button>
        <strong>{viewLabel}</strong>
        <button type="button" className="btn ghost small" onClick={() => shiftMonth(1)} aria-label="Next month">
          ›
        </button>
      </div>
      <div className="dash-month-cal-weekdays">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="dash-month-cal-grid">
        {cells.map((iso, idx) => {
          if (!iso) return <span key={`e-${idx}`} className="dash-month-cal-empty" />;
          const isToday = iso === today;
          const isSelected = iso === selectedDate;
          const hasBook = booked.has(iso);
          return (
            <button
              key={iso}
              type="button"
              className={`dash-month-cal-day${isSelected ? " on" : ""}${isToday ? " today" : ""}${hasBook ? " booked" : ""}`}
              title={hasBook ? "Has booking" : undefined}
              onClick={() => onSelectDate(iso)}
            >
              {Number(iso.slice(8, 10))}
            </button>
          );
        })}
      </div>
      <div className="dash-month-cal-foot">
        <button type="button" className="btn ghost small" onClick={() => onSelectDate(today)}>
          Today
        </button>
        <span className="muted" style={{ fontSize: 12 }}>
          {selectedDate ? formatDate(selectedDate) : monthShort(viewMonth)}
        </span>
      </div>
    </div>
  );
}

function bookingMatchesAsset(state, bookingId, asset) {
  if (!asset || asset === "all") return true;
  if (asset.startsWith("hall:")) {
    const hallId = asset.slice(5);
    return (state.hallReservations || []).some(
      (r) => r.bookingId === bookingId && r.hallId === hallId && r.status !== "Cancelled"
    );
  }
  if (asset === "retreat") {
    const b = (state.bookings || []).find((x) => x.id === bookingId);
    return b?.packageId === "pkg-retreat" || /royal family retreat/i.test(String(b?.type || ""));
  }
  if (asset.startsWith("roomType:")) {
    const typeId = asset.slice(9);
    return (state.roomReservations || []).some((r) => {
      if (r.bookingId !== bookingId || ["Cancelled", "Checked out"].includes(r.status)) return false;
      const room = (state.rooms || []).find((rm) => rm.id === r.roomId);
      return room?.typeId === typeId;
    });
  }
  return true;
}

export default function Dashboard({ state, go, staffUser }) {
  const today = todayISO();
  const currentMonthStart = startOfMonthISO(new Date(`${today}T12:00:00`));
  const yearStart = `${today.slice(0, 4)}-01-01`;
  // Align ranges with Reports → cashbook presets (Week / 6 months / Year).
  const weekStart = addDays(today, -((new Date(`${today}T12:00:00`).getDay() + 6) % 7));
  const sixMonthStart = monthsAgoISO(today, 5);
  const next30 = addDays(today, 30);

  const [from, setFrom] = useState(currentMonthStart);
  const [to, setTo] = useState(today);
  const [filterMonth, setFilterMonth] = useState(today.slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(today);
  const [filterAsset, setFilterAsset] = useState("all");

  const rangeFrom = from && to && from > to ? to : from || currentMonthStart;
  const rangeTo = from && to && from > to ? from : to || today;

  const filterMonthStart = `${filterMonth}-01`;
  const filterMonthEnd = endOfMonthISO(filterMonthStart);
  const filterMonthTo = filterMonthEnd > today ? today : filterMonthEnd;
  const isCurrentFilterMonth = filterMonth === today.slice(0, 7);

  function applyMonth(monthYm, focusDay) {
    const start = `${monthYm}-01`;
    const end = endOfMonthISO(start);
    const cappedEnd = end > today ? today : end;
    setFilterMonth(monthYm);
    const day =
      focusDay && focusDay.slice(0, 7) === monthYm
        ? focusDay
        : monthYm === today.slice(0, 7)
          ? today
          : start;
    setSelectedDate(day > today ? today : day);
    setFrom(start);
    setTo(cappedEnd < start ? start : cappedEnd);
  }

  function applyDate(iso) {
    const day = String(iso || "").slice(0, 10);
    if (!day) return;
    // Day click / Today → Period KPIs for that day only (not whole month).
    setSelectedDate(day);
    setFilterMonth(day.slice(0, 7));
    setFrom(day);
    setTo(day);
  }

  const cur = state.property.currency;
  const loc = state.property.locale;
  const m = (n) => money(n, cur, loc);

  const assetOptions = useMemo(() => {
    const focus = selectedDate || today;
    const halls = (state.halls || []).map((h) => {
      const booked = (state.hallReservations || []).some(
        (r) => r.hallId === h.id && r.status !== "Cancelled" && hallOccupiesDate(r, focus)
      );
      return {
        id: `hall:${h.id}`,
        label: h.name,
        kind: "Hall",
        detail: h.capacity ? `Capacity ${h.capacity}` : "Function hall",
        status: booked ? "Booked" : "Free",
        booked,
      };
    });
    const retreatBooked = (state.bookings || []).some(
      (b) =>
        isActiveBooking(b) &&
        bookingMatchesAsset(state, b.id, "retreat") &&
        (b.eventDate || b.checkIn) <= focus &&
        (b.checkOut || b.eventDate || b.checkIn) >= focus
    );
    const retreat = {
      id: "retreat",
      label: "The Royal Family Retreat",
      kind: "Stay",
      detail: "4 rooms + kitchen",
      status: retreatBooked ? "Booked" : "Free",
      booked: retreatBooked,
    };
    const types = (state.roomTypes || [])
      .filter((t) => t.id !== "rt-retreat" && !/royal family retreat/i.test(t.name || ""))
      .map((t) => {
        const rooms = (state.rooms || []).filter((r) => r.typeId === t.id);
        const live = rooms.filter((r) => !["Out of order", "Maintenance"].includes(r.status));
        const occupied = new Set(
          (state.roomReservations || [])
            .filter((r) => rooms.some((rm) => rm.id === r.roomId) && roomOccupiesDate(r, focus))
            .map((r) => r.roomId)
        ).size;
        return {
          id: `roomType:${t.id}`,
          label: t.name,
          kind: "Rooms",
          detail: `${live.length} rooms`,
          status: `${occupied} occupied`,
          booked: occupied > 0,
        };
      });
    return [
      {
        id: "all",
        label: "All",
        kind: "Overview",
        detail: "Halls + rooms",
        status: "Full property",
        booked: false,
      },
      ...halls,
      retreat,
      ...types,
    ];
  }, [state, selectedDate, today]);

  const filteredBookingIds = useMemo(() => {
    if (filterAsset === "all") return null;
    return new Set(
      (state.bookings || []).filter((b) => isActiveBooking(b) && bookingMatchesAsset(state, b.id, filterAsset)).map((b) => b.id)
    );
  }, [state, filterAsset]);

  const folios = state.bookings.map((b) => ({ b, ...bookingFolio(state, b.id) }));
  const openAll = folios.filter((x) => x.totals.balance > 0 && !["Cancelled", "Refunded"].includes(x.b.status));
  const open = filteredBookingIds
    ? openAll.filter((x) => filteredBookingIds.has(x.b.id))
    : openAll;
  const due = open.reduce((s, x) => s + x.totals.balance, 0);

  const todayBook = useMemo(
    () => cashbookReport(state, today, today, filteredBookingIds),
    [state, today, filteredBookingIds]
  );
  const periodBook = useMemo(
    () => cashbookReport(state, rangeFrom, rangeTo, filteredBookingIds),
    [state, rangeFrom, rangeTo, filteredBookingIds]
  );
  const rangeLabel = `${formatDate(rangeFrom)} – ${formatDate(rangeTo)}`;

  const roomsInScope = useMemo(() => {
    if (filterAsset.startsWith("roomType:")) {
      const typeId = filterAsset.slice(9);
      return (state.rooms || []).filter((r) => r.typeId === typeId);
    }
    if (filterAsset === "retreat" || filterAsset.startsWith("hall:")) {
      return [];
    }
    return state.rooms || [];
  }, [state.rooms, filterAsset]);

  const roomScopeIds = useMemo(() => new Set(roomsInScope.map((r) => r.id)), [roomsInScope]);

  const occ = useMemo(() => {
    const focus = selectedDate || today;
    if (filterAsset === "all") return occupancyStats(state, focus);
    if (filterAsset.startsWith("roomType:")) {
      const live = roomsInScope.filter((r) => !["Out of order", "Maintenance"].includes(r.status));
      const occupied = new Set(
        (state.roomReservations || [])
          .filter((r) => roomScopeIds.has(r.roomId) && roomOccupiesDate(r, focus))
          .map((r) => r.roomId)
      ).size;
      return { occupied, live: live.length, occPct: live.length ? Math.round((occupied / live.length) * 100) : 0 };
    }
    return { occupied: 0, live: 0, occPct: 0 };
  }, [state, today, selectedDate, filterAsset, roomsInScope, roomScopeIds]);

  const todayHalls = useMemo(() => {
    const focus = selectedDate || today;
    let halls = (state.halls || []).filter((h) =>
      (state.hallReservations || []).some((r) => r.hallId === h.id && hallOccupiesDate(r, focus))
    );
    if (filterAsset.startsWith("hall:")) {
      const hallId = filterAsset.slice(5);
      halls = halls.filter((h) => h.id === hallId);
    } else if (filterAsset === "retreat") {
      const retreatOn = (state.bookings || []).some(
        (b) =>
          isActiveBooking(b) &&
          bookingMatchesAsset(state, b.id, "retreat") &&
          ((b.eventDate || b.checkIn) <= focus && (b.checkOut || b.eventDate || b.checkIn) >= focus)
      );
      return retreatOn ? [{ id: "retreat", name: "The Royal Family Retreat" }] : [];
    } else if (filterAsset.startsWith("roomType:")) {
      return [];
    }
    return halls;
  }, [state, today, selectedDate, filterAsset]);

  const focusDayForMoney = selectedDate || today;
  const dayBook = useMemo(
    () => cashbookReport(state, focusDayForMoney, focusDayForMoney, filteredBookingIds),
    [state, focusDayForMoney, filteredBookingIds]
  );
  // Same figure as Reports → cashbook for that single day (collections − refunds).
  const dayIncome = dayBook.incomeTotal;

  const upcomingEvents = useMemo(() => {
    if (filterAsset.startsWith("roomType:")) {
      const ids = new Set();
      for (const r of state.roomReservations || []) {
        if (["Cancelled", "Checked out"].includes(r.status)) continue;
        if (!roomScopeIds.has(r.roomId)) continue;
        if (r.checkIn < today || r.checkIn >= next30) continue;
        if (r.bookingId) ids.add(r.bookingId);
      }
      return ids.size;
    }
    if (filterAsset === "retreat") {
      return (state.bookings || []).filter((b) => {
        if (!isActiveBooking(b) || !bookingMatchesAsset(state, b.id, "retreat")) return false;
        const day = bookingDay(b);
        return day >= today && day < next30;
      }).length;
    }
    const hallStarts = (state.hallReservations || []).filter((r) => {
      if (r.status === "Cancelled") return false;
      if (filterAsset.startsWith("hall:") && r.hallId !== filterAsset.slice(5)) return false;
      const day = String(r.start || "").slice(0, 10);
      return day >= today && day < next30;
    });
    const ids = new Set(hallStarts.map((r) => r.bookingId).filter(Boolean));
    if (ids.size || filterAsset.startsWith("hall:")) return ids.size;
    return (state.bookings || []).filter((b) => {
      if (!isActiveBooking(b)) return false;
      if (filteredBookingIds && !filteredBookingIds.has(b.id)) return false;
      const day = bookingDay(b);
      return day >= today && day < next30;
    }).length;
  }, [state, today, next30, filterAsset, roomScopeIds, filteredBookingIds]);

  const monthBookings = useMemo(() => {
    return (state.bookings || []).filter((b) => {
      if (!isActiveBooking(b)) return false;
      if (filteredBookingIds && !filteredBookingIds.has(b.id)) return false;
      if (filterAsset !== "all" && !bookingMatchesAsset(state, b.id, filterAsset)) return false;
      const day = bookingDay(b);
      return day >= filterMonthStart && day <= filterMonthEnd;
    }).length;
  }, [state, filterMonthStart, filterMonthEnd, filterAsset, filteredBookingIds]);

  const bookedDaysInFilterMonth = useMemo(() => {
    const days = new Set();
    for (const b of state.bookings || []) {
      if (!isActiveBooking(b)) continue;
      if (filteredBookingIds && !filteredBookingIds.has(b.id)) continue;
      if (filterAsset !== "all" && !bookingMatchesAsset(state, b.id, filterAsset)) continue;
      const day = bookingDay(b);
      if (day && day.slice(0, 7) === filterMonth) days.add(day);
    }
    for (const r of state.hallReservations || []) {
      if (r.status === "Cancelled") continue;
      const day = String(r.start || r.date || "").slice(0, 10);
      if (!day || day.slice(0, 7) !== filterMonth) continue;
      if (filterAsset.startsWith("hall:") && r.hallId !== filterAsset.slice(5)) continue;
      if (filterAsset === "retreat" || filterAsset.startsWith("roomType:")) continue;
      days.add(day);
    }
    return days;
  }, [state, filterMonth, filterAsset, filteredBookingIds]);

  const checkInsToday = useMemo(() => {
    return (state.roomReservations || []).filter((r) => {
      if (r.checkIn !== today || ["Cancelled", "Checked out"].includes(r.status)) return false;
      if (filterAsset.startsWith("roomType:") && !roomScopeIds.has(r.roomId)) return false;
      if (filterAsset === "retreat" || filterAsset.startsWith("hall:")) return false;
      if (filteredBookingIds && r.bookingId && !filteredBookingIds.has(r.bookingId)) return false;
      return true;
    }).length;
  }, [state, today, filterAsset, roomScopeIds, filteredBookingIds]);

  const totalRooms = filterAsset.startsWith("hall:") || filterAsset === "retreat" ? 0 : roomsInScope.length;
  const availableToday = Math.max(0, occ.live - occ.occupied);
  const showRoomPanel = filterAsset === "all" || filterAsset.startsWith("roomType:");
  const showRetreatPanel = filterAsset === "retreat";
  const showHallPanel = filterAsset.startsWith("hall:");
  const retreatBooked = showRetreatPanel && todayHalls.length > 0;
  const hallBooked = showHallPanel && todayHalls.length > 0;
  const selectedHall = showHallPanel
    ? (state.halls || []).find((h) => h.id === filterAsset.slice(5))
    : null;

  const weekBook = useMemo(
    () => cashbookReport(state, weekStart, today, filteredBookingIds),
    [state, weekStart, today, filteredBookingIds]
  );
  const sixBook = useMemo(
    () => cashbookReport(state, sixMonthStart, today, filteredBookingIds),
    [state, sixMonthStart, today, filteredBookingIds]
  );
  const yearBook = useMemo(
    () => cashbookReport(state, yearStart, today, filteredBookingIds),
    [state, yearStart, today, filteredBookingIds]
  );
  const weekIncome = weekBook.incomeTotal;
  const sixIncome = sixBook.incomeTotal;
  const yearIncome = yearBook.incomeTotal;

  const cancelRefundStats = useMemo(() => {
    const inMonth = (iso) => {
      const day = String(iso || "").slice(0, 10);
      return day && day >= filterMonthStart && day <= filterMonthEnd;
    };
    const bookingOk = (bookingId) => {
      if (!bookingId) return filterAsset === "all";
      if (filteredBookingIds) return filteredBookingIds.has(bookingId);
      if (filterAsset !== "all") return bookingMatchesAsset(state, bookingId, filterAsset);
      return true;
    };

    const cancelledRooms = (state.roomReservations || []).filter((r) => {
      if (r.status !== "Cancelled") return false;
      if (!bookingOk(r.bookingId)) return false;
      const when = r.cancelledAt || r.checkIn;
      return inMonth(when);
    });
    const roomsNoRefund = cancelledRooms.filter((r) => r.noRefund !== false);
    const chargesDroppedNoRefund = roomsNoRefund.reduce((s, r) => s + Number(r.chargesDropped || 0), 0);

    const cancelledBookings = (state.bookings || []).filter((b) => {
      if (b.status !== "Cancelled" && b.status !== "Refunded") return false;
      if (!bookingOk(b.id)) return false;
      return inMonth(b.cancelledAt || b.eventDate || b.checkIn);
    }).length;

    const bookingIds = new Set((state.bookings || []).map((b) => b.id));
    const refundPaid = (state.payments || [])
      .filter((p) => {
        if (p.type !== "Refund" && p.type !== "Deposit return") return false;
        const st = String(p.status || "SUCCESS").toUpperCase();
        if (st === "REVERSED" || st === "FAILED" || st === "REJECTED") return false;
        if (p.bookingId && !bookingIds.has(p.bookingId)) return false;
        if (!bookingOk(p.bookingId)) return false;
        return inMonth(p.at || p.date);
      })
      .reduce((s, p) => s + Number(p.amount || 0), 0);

    const refundPending = (state.refunds || [])
      .filter((r) => {
        if (String(r.status || "").toUpperCase() !== "PENDING") return false;
        if (!bookingOk(r.bookingId)) return false;
        return inMonth(r.at || r.date || r.createdAt);
      })
      .reduce((s, r) => s + Number(r.amount || 0), 0);

    /** Money still with the hotel that guests have overpaid (not yet refunded). */
    let refundMoneyWithHotel = 0;
    for (const b of state.bookings || []) {
      if (!bookingOk(b.id)) continue;
      const { totals } = bookingFolio(state, b.id);
      if (totals.balance < 0) refundMoneyWithHotel += Math.abs(totals.balance);
    }

    return {
      roomsCancelled: cancelledRooms.length,
      roomsNoRefund: roomsNoRefund.length,
      chargesDroppedNoRefund,
      cancelledBookings,
      refundPaid,
      refundPending,
      refundMoneyWithHotel,
    };
  }, [state, filterMonthStart, filterMonthEnd, filterAsset, filteredBookingIds]);

  const monthCashAll = useMemo(
    () => cashbookReport(state, filterMonthStart, filterMonthTo, filteredBookingIds),
    [state, filterMonthStart, filterMonthTo, filteredBookingIds]
  );
  const monthIncome = monthCashAll.incomeTotal;
  const monthNet = filterAsset === "all" ? monthCashAll.net : monthCashAll.incomeTotal;

  const assetLabel = assetOptions.find((a) => a.id === filterAsset)?.label || "All";

  const focusDay = selectedDate || today;
  const focusIsToday = focusDay === today;

  const hallHeadline =
    todayHalls.length === 0
      ? filterAsset.startsWith("roomType:")
        ? `${occ.occupied} occupied · ${availableToday} free`
        : filterAsset === "retreat"
          ? "Not booked"
          : "No hall booked"
      : todayHalls.length === 1
        ? todayHalls[0].name
        : todayHalls.map((h) => h.name).join(" · ");
  const hallSub =
    todayHalls.length === 0
      ? filterAsset.startsWith("roomType:")
        ? `${assetLabel} · ${formatDate(focusDay)}`
        : filterAsset === "all"
          ? `Free · ${formatDate(focusDay)}`
          : `Free · ${formatDate(focusDay)}`
      : todayHalls.length === 1
        ? filterAsset === "all"
          ? `Event · ${formatDate(focusDay)}`
          : `Event · ${formatDate(focusDay)}`
        : `${todayHalls.length} events · ${formatDate(focusDay)}`;

  const todayBookingCardTitle =
    filterAsset === "all"
      ? focusIsToday
        ? "Today's all booking"
        : `All booking · ${formatDate(focusDay)}`
      : filterAsset.startsWith("hall:")
        ? `${assetLabel} · ${formatDate(focusDay)}`
        : filterAsset === "retreat"
          ? `The Royal Family Retreat · ${formatDate(focusDay)}`
          : filterAsset.startsWith("roomType:")
            ? `${assetLabel} · ${formatDate(focusDay)}`
            : `${assetLabel} · ${formatDate(focusDay)}`;

  function setThisMonth() {
    applyMonth(today.slice(0, 7), today);
  }

  function setTodayOnly() {
    applyDate(today);
  }

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Good Morning";
    if (h < 17) return "Good Afternoon";
    return "Good Evening";
  }, []);

  const greetName = staffUser?.name || staffUser?.roleLabel || "Staff";
  const greetDate = new Date(`${today}T12:00:00`).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const mobileDayCards = useMemo(() => {
    const focus = selectedDate || today;
    const cards = [];
    for (const r of state.hallReservations || []) {
      if (r.status === "Cancelled") continue;
      if (!hallOccupiesDate(r, focus)) continue;
      if (filterAsset.startsWith("hall:") && r.hallId !== filterAsset.slice(5)) continue;
      if (filterAsset === "retreat" || filterAsset.startsWith("roomType:")) continue;
      const hall = (state.halls || []).find((h) => h.id === r.hallId);
      const b = (state.bookings || []).find((x) => x.id === r.bookingId);
      if (b && !isActiveBooking(b)) continue;
      cards.push({
        key: `h-${r.id}`,
        bookingId: r.bookingId,
        venue: hall?.name || "Hall",
        title: b?.eventName || b?.type || r.occasion || "Function",
        time: [r.startTime, r.endTime].filter(Boolean).join(" – ") || b?.eventTime || "",
        status: b?.status || r.status || "Confirmed",
      });
    }
    for (const r of state.roomReservations || []) {
      if (["Cancelled", "Checked out"].includes(r.status)) continue;
      if (!(roomOccupiesDate(r, focus) || r.checkIn === focus)) continue;
      if (filterAsset.startsWith("hall:") || filterAsset === "retreat") continue;
      if (filterAsset.startsWith("roomType:") && !roomScopeIds.has(r.roomId)) continue;
      const room = (state.rooms || []).find((x) => x.id === r.roomId);
      const b = (state.bookings || []).find((x) => x.id === r.bookingId);
      if (b && !isActiveBooking(b)) continue;
      cards.push({
        key: `r-${r.id}`,
        bookingId: r.bookingId,
        venue: room?.number ? `Room ${room.number}` : room?.name || "Room",
        title: b?.type || b?.eventName || "Room stay",
        time: r.checkIn === focus ? "Check-in" : r.checkOut === focus ? "Check-out" : "In-house",
        status: r.status || b?.status || "Confirmed",
      });
    }
    return cards;
  }, [state, selectedDate, today, filterAsset, roomScopeIds]);

  const todayBookingCount = mobileDayCards.length;
  const hallCount = (state.halls || []).length;

  function statusTone(status) {
    const s = String(status || "").toLowerCase();
    if (s.includes("cancel") || s.includes("refund")) return "is-bad";
    if (s.includes("pending") || s.includes("hold") || s.includes("draft")) return "is-warn";
    return "is-ok";
  }

  return (
    <>
      <section className="staff-m-dash" aria-label="Phone dashboard">
        <div className="staff-m-dash-greet">
          <p className="hi">{greeting}</p>
          <strong>{greetName}</strong>
          <span className="when">{greetDate}</span>
        </div>

        <div className="staff-m-asset-row" role="tablist" aria-label="Hall or rooms">
          {assetOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="tab"
              aria-selected={filterAsset === opt.id}
              className={`staff-m-chip${filterAsset === opt.id ? " on" : ""}`}
              onClick={() => setFilterAsset(opt.id)}
            >
              {opt.id === "all" ? "All" : opt.label}
            </button>
          ))}
        </div>

        {showHallPanel && selectedHall ? (
          <div className="staff-m-hall-panel">
            <h3>{selectedHall.name}</h3>
            <div className="staff-m-hall-row">
              <span>Today&apos;s status</span>
              <strong className={`staff-m-status ${hallBooked ? "is-warn" : "is-ok"}`}>
                {hallBooked ? "Booked" : "Available"}
              </strong>
            </div>
            <div className="staff-m-hall-row">
              <span>This month</span>
              <strong>{monthBookings} bookings</strong>
            </div>
            <div className="staff-m-hall-row">
              <span>Revenue</span>
              <strong>{m(monthIncome)}</strong>
            </div>
            <div className="staff-m-hall-row">
              <span>Pending</span>
              <strong>{m(due)}</strong>
            </div>
          </div>
        ) : null}

        <h3 className="staff-m-sec">Today&apos;s Overview</h3>
        <div className="staff-m-ov-grid">
          <button type="button" className="staff-m-ov-card" onClick={() => go("calendar")}>
                  <span className="n">{String(todayBookingCount)}</span>
                  <span className="l">Bookings</span>
                </button>
                <button type="button" className="staff-m-ov-card" onClick={() => go("calendar")}>
                  <span className="n">{String(upcomingEvents)}</span>
                  <span className="l">Events</span>
                </button>
                <button type="button" className="staff-m-ov-card" onClick={() => go("rooms")}>
                  <span className="n">{String(availableToday)}</span>
                  <span className="l">Rooms</span>
                </button>
                <button type="button" className="staff-m-ov-card" onClick={() => go("venues")}>
                  <span className="n">{String(hallCount)}</span>
                  <span className="l">Halls</span>
          </button>
        </div>

        <div className="staff-m-rev">
          <span className="l">Today&apos;s Revenue</span>
          <span className="n">{m(dayIncome)}</span>
        </div>

        <h3 className="staff-m-sec">Today&apos;s Bookings</h3>
        {mobileDayCards.length ? (
          <div className="staff-m-book-list">
            {mobileDayCards.map((c) => (
              <button
                key={c.key}
                type="button"
                className="staff-m-book-card"
                onClick={() => (c.bookingId ? go("billing", { bookingId: c.bookingId }) : go("calendar"))}
              >
                <span className="hall">{c.venue}</span>
                <span className="title">{c.title}</span>
                <span className="meta">{c.time || formatDate(focusDay)}</span>
                <span className="foot">
                  <span className={`staff-m-status ${statusTone(c.status)}`}>{c.status}</span>
                  <span aria-hidden="true">›</span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="staff-m-empty">
            <p>No bookings scheduled for this date.</p>
            <button type="button" className="btn" onClick={() => go("reserve")}>
              Create Booking
            </button>
          </div>
        )}
      </section>

      <div className="staff-desk-full">
      <PageHead title="Dashboard" sub={`${state.property.name} · ${formatDate(today)}`}>
        <button className="btn ghost" onClick={() => go("expenses")}>
          Expense entry
        </button>
        <button className="btn ghost" onClick={() => go("calendar")}>
          Calendar
        </button>
        <button className="btn" onClick={() => go("reserve")}>
          + New booking
        </button>
      </PageHead>

      <div className="panel dash-filters">
        <div className="dash-filter-row dash-filter-row-cal">
          <div className="dash-filter-month">
            <span>Month calendar</span>
            <MonthCalendarInline
              monthValue={filterMonth}
              selectedDate={selectedDate}
              onSelectDate={applyDate}
              onSelectMonth={applyMonth}
              today={today}
              bookedDays={bookedDaysInFilterMonth}
            />
          </div>
          <div className="dash-filter-assets">
            <span className="dash-filter-label">Function hall / rooms</span>
            <div className="dash-asset-grid">
              {assetOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`dash-asset-card${filterAsset === opt.id ? " on" : ""}${opt.booked ? " booked" : ""}`}
                  onClick={() => setFilterAsset(opt.id)}
                >
                  <span className="dash-asset-kind">{opt.kind}</span>
                  <span className="dash-asset-name">{opt.label}</span>
                  <span className="dash-asset-detail">{opt.detail}</span>
                  <span className={`dash-asset-status${opt.booked ? " busy" : ""}`}>{opt.status}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="dash-overview-kpis">
        <button type="button" className="dash-ov-card tone-hall" onClick={() => go("calendar")}>
          <span className="dash-ov-k">{todayBookingCardTitle}</span>
          <span className="dash-ov-v">{hallHeadline}</span>
          <span className="dash-ov-s">{hallSub}</span>
        </button>
        <button type="button" className="dash-ov-card tone-up" onClick={() => go("calendar")}>
          <span className="dash-ov-k">Upcoming events</span>
          <span className="dash-ov-v">{upcomingEvents}</span>
          <span className="dash-ov-s">Next 30 days</span>
        </button>
        <button type="button" className="dash-ov-card tone-book" onClick={() => go("reserve")}>
          <span className="dash-ov-k">This month bookings</span>
          <span className="dash-ov-v">{monthBookings}</span>
          <span className="dash-ov-s">{monthLabel(filterMonthStart)}</span>
        </button>
        <div className="dash-ov-card tone-rev">
          <span className="dash-ov-k">This month revenue</span>
          <span className="dash-ov-v">{m(monthIncome)}</span>
          <span className="dash-ov-s">
            {isCurrentFilterMonth ? "Up to today" : formatDate(filterMonthStart) + " – " + formatDate(filterMonthEnd)}
          </span>
        </div>
        <button type="button" className="dash-ov-card tone-pend" onClick={() => go("billing")}>
          <span className="dash-ov-k">Pending payments</span>
          <span className="dash-ov-v">{m(due)}</span>
          <span className="dash-ov-s">To be collected · {open.length} bills</span>
        </button>
      </div>

      <div className="panel dash-room-status">
        <div className="panel-head">
          <h3>Accounts · refunds · {monthShort(filterMonthStart)}</h3>
          <button type="button" className="btn ghost small" onClick={() => go("billing")}>
            Payment &amp; Invoice
          </button>
        </div>
        <div className="dash-room-grid dash-refund-grid">
          <div className="dash-room-stat rs-hold">
            <span className="dash-ov-k">Guest credit with hotel</span>
            <span className="dash-ov-v">{m(cancelRefundStats.refundMoneyWithHotel)}</span>
            <span className="dash-ov-s">Open bills · extra held (paid − bill). Same as Payment &amp; Invoice “To refund”.</span>
          </div>
          <div className="dash-room-stat rs-free">
            <span className="dash-ov-k">Refunds paid out</span>
            <span className="dash-ov-v">{m(cancelRefundStats.refundPaid)}</span>
            <span className="dash-ov-s">Cash/UPI already returned to guests this month</span>
          </div>
          <div className="dash-room-stat rs-total">
            <span className="dash-ov-k">Refunds awaiting approval</span>
            <span className="dash-ov-v">{m(cancelRefundStats.refundPending)}</span>
            <span className="dash-ov-s">Waiting for manager approval</span>
          </div>
          <div className="dash-room-stat rs-occ">
            <span className="dash-ov-k">Rooms cancelled</span>
            <span className="dash-ov-v">{cancelRefundStats.roomsCancelled}</span>
            <span className="dash-ov-s">
              Count only · {cancelRefundStats.roomsNoRefund} cancelled without posting a refund
            </span>
          </div>
        </div>
      </div>

      {showRoomPanel ? (
        <div className="panel dash-room-status">
          <div className="panel-head">
            <h3>{filterAsset === "all" ? "Room status (all rooms)" : `Room status · ${assetLabel}`}</h3>
            <button type="button" className="btn ghost small" onClick={() => go("reserve")}>
              View all
            </button>
          </div>
          <div className="dash-room-grid">
            <div className="dash-room-stat rs-total">
              <span className="dash-ov-k">Total rooms</span>
              <span className="dash-ov-v">{totalRooms}</span>
            </div>
            <div className="dash-room-stat rs-occ">
              <span className="dash-ov-k">Occupied</span>
              <span className="dash-ov-v">{occ.occupied}</span>
            </div>
            <div className="dash-room-stat rs-free">
              <span className="dash-ov-k">Available</span>
              <span className="dash-ov-v">{availableToday}</span>
            </div>
            <div className="dash-room-stat rs-in">
              <span className="dash-ov-k">Check-ins</span>
              <span className="dash-ov-v">{checkInsToday}</span>
            </div>
          </div>
        </div>
      ) : null}

      {showRetreatPanel ? (
        <div className="panel dash-room-status">
          <div className="panel-head">
            <h3>The Royal Family Retreat</h3>
            <button type="button" className="btn ghost small" onClick={() => go("reserve")}>
              Book retreat
            </button>
          </div>
          <div className="dash-room-grid">
            <div className={`dash-room-stat ${retreatBooked ? "rs-occ" : "rs-free"}`}>
              <span className="dash-ov-k">Status · {formatDate(focusDay)}</span>
              <span className="dash-ov-v">{retreatBooked ? "Booked" : "Free"}</span>
            </div>
            <div className="dash-room-stat rs-total">
              <span className="dash-ov-k">Package</span>
              <span className="dash-ov-v" style={{ fontSize: 16 }}>
                4 rooms + kitchen
              </span>
            </div>
            <div className="dash-room-stat rs-in">
              <span className="dash-ov-k">This month bookings</span>
              <span className="dash-ov-v">{monthBookings}</span>
            </div>
            <div className="dash-room-stat rs-total">
              <span className="dash-ov-k">Day revenue (net)</span>
              <span className="dash-ov-v">{m(dayIncome)}</span>
              <span className="dash-ov-s">
                {dayBook.refundTotal > 0
                  ? `In ${m(dayBook.incomeGross)} − refunds ${m(dayBook.refundTotal)}`
                  : "Same as Reports day cashbook"}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {showHallPanel ? (
        <div className="panel dash-room-status">
          <div className="panel-head">
            <h3>{selectedHall?.name || assetLabel}</h3>
            <button type="button" className="btn ghost small" onClick={() => go("calendar")}>
              Calendar
            </button>
          </div>
          <div className="dash-room-grid">
            <div className={`dash-room-stat ${hallBooked ? "rs-occ" : "rs-free"}`}>
              <span className="dash-ov-k">Status · {formatDate(focusDay)}</span>
              <span className="dash-ov-v">{hallBooked ? "Booked" : "Free"}</span>
            </div>
            <div className="dash-room-stat rs-total">
              <span className="dash-ov-k">Capacity</span>
              <span className="dash-ov-v">{selectedHall?.capacity || "—"}</span>
            </div>
            <div className="dash-room-stat rs-in">
              <span className="dash-ov-k">This month bookings</span>
              <span className="dash-ov-v">{monthBookings}</span>
            </div>
            <div className="dash-room-stat rs-total">
              <span className="dash-ov-k">Day revenue (net)</span>
              <span className="dash-ov-v">{m(dayIncome)}</span>
              <span className="dash-ov-s">
                {dayBook.refundTotal > 0
                  ? `In ${m(dayBook.incomeGross)} − refunds ${m(dayBook.refundTotal)}`
                  : "Same as Reports day cashbook"}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      <div className="panel dash-report">
        <div className="panel-head">
          <h3>Report summary</h3>
        </div>
        <div className="dash-report-grid">
          <div className="dash-report-item">
            <span className="dash-ov-k">Day · net collections</span>
            <span className="dash-ov-v">{m(dayIncome)}</span>
            <span className="dash-ov-s">
              Collections − refunds · {formatDate(focusDay)}
              {dayBook.refundTotal > 0
                ? ` · in ${m(dayBook.incomeGross)} − refunds ${m(dayBook.refundTotal)}`
                : " · = Reports cashbook that day"}
            </span>
          </div>
          <div className="dash-report-item">
            <span className="dash-ov-k">Week · net collections</span>
            <span className="dash-ov-v">{m(weekIncome)}</span>
            <span className="dash-ov-s">
              Collections − refunds · Mon–today · {formatDate(weekStart)} – {formatDate(today)}
              {weekBook.refundTotal > 0 ? ` · refunds ${m(weekBook.refundTotal)}` : ""}
            </span>
          </div>
          <div className="dash-report-item">
            <span className="dash-ov-k">Month · net collections</span>
            <span className="dash-ov-v">{m(monthIncome)}</span>
            <span className="dash-ov-s">
              Collections − refunds · {monthLabel(filterMonthStart)}
              {isCurrentFilterMonth ? " · up to today" : ""}
              {monthCashAll.refundTotal > 0 ? ` · refunds ${m(monthCashAll.refundTotal)}` : ""}
            </span>
          </div>
          <div className="dash-report-item">
            <span className="dash-ov-k">6 months · net collections</span>
            <span className="dash-ov-v">{m(sixIncome)}</span>
            <span className="dash-ov-s">
              Collections − refunds · {formatDate(sixMonthStart)} – {formatDate(today)}
              {sixBook.refundTotal > 0 ? ` · refunds ${m(sixBook.refundTotal)}` : ""}
            </span>
          </div>
          <div className="dash-report-item">
            <span className="dash-ov-k">Year · net collections</span>
            <span className="dash-ov-v">{m(yearIncome)}</span>
            <span className="dash-ov-s">
              Collections − refunds · {today.slice(0, 4)} · {formatDate(yearStart)} – {formatDate(today)}
              {yearBook.refundTotal > 0 ? ` · refunds ${m(yearBook.refundTotal)}` : ""}
            </span>
          </div>
          <div className="dash-report-net">
            <span className="dash-ov-k">{filterAsset === "all" ? "Net profit (selected month)" : "Revenue (selection)"}</span>
            <span className="dash-ov-v">{m(monthNet)}</span>
            <span className="dash-ov-s">
              {filterAsset === "all"
                ? "Net collections − expenses · after diesel & other costs"
                : "Net collections for selection"}{" "}
              · {monthLabel(filterMonthStart)}
            </span>
          </div>
        </div>
        <div className="dash-report-grid" style={{ marginTop: 10 }}>
          <div className="dash-report-item">
            <span className="dash-ov-k">Cash received</span>
            <span className="dash-ov-v">{m(monthCashAll.rails?.cash || 0)}</span>
            <span className="dash-ov-s">Month · after refunds</span>
          </div>
          <div className="dash-report-item">
            <span className="dash-ov-k">UPI received</span>
            <span className="dash-ov-v">{m(monthCashAll.rails?.upi || 0)}</span>
            <span className="dash-ov-s">Month · after refunds</span>
          </div>
          <div className="dash-report-item">
            <span className="dash-ov-k">Card received</span>
            <span className="dash-ov-v">{m(monthCashAll.rails?.card || 0)}</span>
            <span className="dash-ov-s">Month · after refunds</span>
          </div>
          <div className="dash-report-item">
            <span className="dash-ov-k">Bank received</span>
            <span className="dash-ov-v">{m(monthCashAll.rails?.bank || 0)}</span>
            <span className="dash-ov-s">Month · after refunds</span>
          </div>
          <div className="dash-report-item">
            <span className="dash-ov-k">Advance (kind)</span>
            <span className="dash-ov-v">{m(monthCashAll.byKind?.advance ?? monthCashAll.advance ?? 0)}</span>
            <span className="dash-ov-s">Advance collections · month</span>
          </div>
          <div className="dash-report-item">
            <span className="dash-ov-k">Final (kind)</span>
            <span className="dash-ov-v">{m(monthCashAll.byKind?.final || 0)}</span>
            <span className="dash-ov-s">Final payments · month</span>
          </div>
        </div>
      </div>

      <h3 className="dash-section-title">Today</h3>
      <p className="muted" style={{ margin: "0 0 8px", maxWidth: 52 + "rem" }}>
        Collections and customer refunds are shown separately. Net = collections − refunds. If refunds are higher than collections, a duplicate refund may be on a bill — open Payment &amp; Invoice and reverse the extra one.
      </p>
      <div className="kpis dash-kpis">
        <div className="kpi tone-b">
          <div className="k">Today collections</div>
          <div className="v">{m(todayBook.incomeGross || 0)}</div>
          <div className="s">Money taken in (before refunds)</div>
        </div>
        <div className="kpi tone-e">
          <div className="k">Today refunds</div>
          <div className="v">{m(todayBook.refundTotal || 0)}</div>
          <div className="s">Customer refunds posted today</div>
        </div>
        <div className="kpi tone-d">
          <div className="k">Today net money</div>
          <div className="v">{m(todayBook.incomeTotal)}</div>
          <div className="s">Collections − refunds</div>
        </div>
        <div className="kpi tone-a">
          <div className="k">Of which · Hall (net)</div>
          <div className="v">{m(todayBook.hall)}</div>
          <div className="s">Hall share after refunds</div>
        </div>
        <div className="kpi tone-b">
          <div className="k">Of which · Rooms (net)</div>
          <div className="v">{m(todayBook.room)}</div>
          <div className="s">Room share after refunds</div>
        </div>
        <div className="kpi tone-c">
          <div className="k">Of which · Food &amp; extras</div>
          <div className="v">{m(todayBook.food + todayBook.otherIncome)}</div>
          <div className="s">Extras share after refunds</div>
        </div>
        <div className="kpi tone-e">
          <div className="k">Today expenses</div>
          <div className="v">{m(todayBook.expenseTotal)}</div>
          <div className="s">From expense entry</div>
        </div>
        <div className="kpi tone-c">
          <div className="k">Today net profit</div>
          <div className="v">{m(todayBook.net)}</div>
          <div className="s">Net money − expenses</div>
        </div>
        <div className="kpi tone-e">
          <div className="k">Pending payments</div>
          <div className="v">{m(due)}</div>
          <div className="s">{open.length} open bills · to collect{filterAsset !== "all" ? ` · ${assetLabel}` : ""}</div>
        </div>
      </div>

      <h3 className="dash-section-title">Today · payment received by type</h3>
      <p className="muted" style={{ margin: "0 0 8px" }}>
        Mode = how money came in. Kind = advance / final / settlement. Mode figures are after refunds.
      </p>
      <div className="kpis dash-kpis">
        <div className="kpi tone-d">
          <div className="k">Cash</div>
          <div className="v">{m(todayBook.rails?.cash || 0)}</div>
          <div className="s">Cash received today</div>
        </div>
        <div className="kpi tone-c">
          <div className="k">UPI</div>
          <div className="v">{m(todayBook.rails?.upi || 0)}</div>
          <div className="s">UPI received today</div>
        </div>
        <div className="kpi tone-b">
          <div className="k">Card</div>
          <div className="v">{m(todayBook.rails?.card || 0)}</div>
          <div className="s">Card received today</div>
        </div>
        <div className="kpi tone-a">
          <div className="k">Bank transfer</div>
          <div className="v">{m(todayBook.rails?.bank || 0)}</div>
          <div className="s">Bank / NEFT / IMPS</div>
        </div>
        <div className="kpi tone-b">
          <div className="k">Advance</div>
          <div className="v">{m(todayBook.byKind?.advance ?? todayBook.advance ?? 0)}</div>
          <div className="s">Kind · advance collections</div>
        </div>
        <div className="kpi tone-a">
          <div className="k">Final payment</div>
          <div className="v">{m(todayBook.byKind?.final || 0)}</div>
          <div className="s">Kind · final collections</div>
        </div>
        <div className="kpi tone-c">
          <div className="k">Settlement</div>
          <div className="v">{m(todayBook.byKind?.settlement || 0)}</div>
          <div className="s">Kind · other settlements</div>
        </div>
      </div>

      <div className="dash-period-head">
        <h3 className="dash-section-title" style={{ margin: 0 }}>
          Period money
        </h3>
        <div className="dash-period-filters">
          <label>
            From
            <input
              type="date"
              value={rangeFrom}
              max={rangeTo}
              onChange={(e) => {
                const v = e.target.value || currentMonthStart;
                setFrom(v);
                setFilterMonth(v.slice(0, 7));
                setSelectedDate(v);
              }}
            />
          </label>
          <label>
            To
            <input
              type="date"
              value={rangeTo}
              min={rangeFrom}
              max={today}
              onChange={(e) => {
                const v = e.target.value || today;
                setTo(v);
                if (v.slice(0, 7) === filterMonth) setSelectedDate(v);
              }}
            />
          </label>
          <button className="btn ghost small" type="button" onClick={setThisMonth}>
            This month
          </button>
          <button
            className="btn ghost small"
            type="button"
            onClick={() => {
              setFrom(weekStart);
              setTo(today);
              setSelectedDate(today);
              setFilterMonth(today.slice(0, 7));
            }}
          >
            This week
          </button>
          <button className="btn ghost small" type="button" onClick={setTodayOnly}>
            Today
          </button>
          <button
            className="btn ghost small"
            type="button"
            onClick={() => {
              setFrom(sixMonthStart);
              setTo(today);
              setSelectedDate(today);
              setFilterMonth(today.slice(0, 7));
            }}
          >
            6 months
          </button>
          <button
            className="btn ghost small"
            type="button"
            onClick={() => {
              setFrom(yearStart);
              setTo(today);
              setSelectedDate(today);
              setFilterMonth(today.slice(0, 7));
            }}
          >
            Year
          </button>
        </div>
      </div>
      <p className="muted" style={{ margin: "0 0 8px" }}>
        Revenue = collections − refunds for <strong>{rangeLabel}</strong>
        {periodBook.refundTotal > 0
          ? ` · collections ${m(periodBook.incomeGross || 0)}, refunds ${m(periodBook.refundTotal)}`
          : ""}
        .
      </p>
      <div className="kpis dash-kpis">
        <div className="kpi tone-b">
          <div className="k">Total revenue (net)</div>
          <div className="v">{m(periodBook.incomeTotal)}</div>
          <div className="s">
            {periodBook.refundTotal > 0
              ? `Collections ${m(periodBook.incomeGross || 0)} − refunds ${m(periodBook.refundTotal)}`
              : rangeLabel}
          </div>
        </div>
        <div className="kpi tone-e">
          <div className="k">Total expenses</div>
          <div className="v">{m(periodBook.expenseTotal)}</div>
          <div className="s">{rangeLabel}</div>
        </div>
        <div className="kpi tone-c">
          <div className="k">Net profit</div>
          <div className="v">{m(periodBook.net)}</div>
          <div className="s">Revenue − expenses</div>
        </div>
        <div className="kpi tone-b">
          <div className="k">Function hall revenue</div>
          <div className="v">{m(periodBook.hall)}</div>
          <div className="s">Hall share in this period</div>
        </div>
        <div className="kpi tone-a">
          <div className="k">Room revenue</div>
          <div className="v">{m(periodBook.room)}</div>
          <div className="s">Room share in this period</div>
        </div>
        <div className="kpi tone-c">
          <div className="k">Food &amp; extras</div>
          <div className="v">{m(periodBook.food + periodBook.otherIncome)}</div>
          <div className="s">Extras share in this period</div>
        </div>
      </div>

      <h3 className="dash-section-title">Period · payment received by type</h3>
      <p className="muted" style={{ margin: "0 0 8px" }}>
        Same split for <strong>{rangeLabel}</strong>. Mode amounts are after refunds.
      </p>
      <div className="kpis dash-kpis">
        <div className="kpi tone-d">
          <div className="k">Cash</div>
          <div className="v">{m(periodBook.rails?.cash || 0)}</div>
          <div className="s">Cash in period</div>
        </div>
        <div className="kpi tone-c">
          <div className="k">UPI</div>
          <div className="v">{m(periodBook.rails?.upi || 0)}</div>
          <div className="s">UPI in period</div>
        </div>
        <div className="kpi tone-b">
          <div className="k">Card</div>
          <div className="v">{m(periodBook.rails?.card || 0)}</div>
          <div className="s">Card in period</div>
        </div>
        <div className="kpi tone-a">
          <div className="k">Bank transfer</div>
          <div className="v">{m(periodBook.rails?.bank || 0)}</div>
          <div className="s">Bank / NEFT / IMPS</div>
        </div>
        <div className="kpi tone-b">
          <div className="k">Advance</div>
          <div className="v">{m(periodBook.byKind?.advance ?? periodBook.advance ?? 0)}</div>
          <div className="s">Kind · advance</div>
        </div>
        <div className="kpi tone-a">
          <div className="k">Final payment</div>
          <div className="v">{m(periodBook.byKind?.final || 0)}</div>
          <div className="s">Kind · final</div>
        </div>
        <div className="kpi tone-c">
          <div className="k">Settlement</div>
          <div className="v">{m(periodBook.byKind?.settlement || 0)}</div>
          <div className="s">Kind · settlement</div>
        </div>
      </div>
      </div>
    </>
  );
}
