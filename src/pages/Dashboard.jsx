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

function payDay(p) {
  return String(p.at || p.date || "").slice(0, 10);
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
function MonthCalendarInline({ value, onChange, today, bookedDays }) {
  const viewMonth = `${value}-01`;
  const cells = useMemo(() => buildMonthCells(viewMonth), [viewMonth]);
  const viewLabel = monthLabel(viewMonth);
  const booked = bookedDays || new Set();

  function shiftMonth(delta) {
    const d = parseISO(viewMonth);
    onChange(startOfMonthISO(new Date(d.getFullYear(), d.getMonth() + delta, 1)).slice(0, 7));
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
          const hasBook = booked.has(iso);
          return (
            <button
              key={iso}
              type="button"
              className={`dash-month-cal-day${isToday ? " today" : ""}${hasBook ? " booked" : ""}`}
              title={hasBook ? "Has booking" : undefined}
              onClick={() => onChange(iso.slice(0, 7))}
            >
              {Number(iso.slice(8, 10))}
            </button>
          );
        })}
      </div>
      <div className="dash-month-cal-foot">
        <button type="button" className="btn ghost small" onClick={() => onChange(today.slice(0, 7))}>
          This month
        </button>
        <span className="muted" style={{ fontSize: 12 }}>
          {monthShort(viewMonth)}
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

function paymentsIncome(state, from, to, bookingIdSet) {
  const bookingIds = new Set((state.bookings || []).map((b) => b.id));
  return (state.payments || [])
    .filter((p) => p.type !== "Deposit")
    .filter((p) => {
      const st = String(p.status || "SUCCESS").toUpperCase();
      if (st === "REVERSED" || st === "FAILED" || st === "REJECTED") return false;
      if (p.bookingId && !bookingIds.has(p.bookingId)) return false;
      const day = payDay(p);
      if (!day) return false;
      if (from && day < from) return false;
      if (to && day > to) return false;
      if (bookingIdSet && !bookingIdSet.has(p.bookingId)) return false;
      return true;
    })
    .reduce((s, p) => {
      const amt = Number(p.amount || 0);
      if (p.type === "Refund" || p.type === "Deposit return") return s - amt;
      return s + amt;
    }, 0);
}

export default function Dashboard({ state, go }) {
  const today = todayISO();
  const currentMonthStart = startOfMonthISO(new Date(`${today}T12:00:00`));
  const yearStart = `${today.slice(0, 4)}-01-01`;
  const weekStart = addDays(today, -6);
  const sixMonthStart = monthsAgoISO(today, 5);
  const next30 = addDays(today, 30);

  const [from, setFrom] = useState(currentMonthStart);
  const [to, setTo] = useState(today);
  const [filterMonth, setFilterMonth] = useState(today.slice(0, 7));
  const [filterAsset, setFilterAsset] = useState("all");

  const rangeFrom = from && to && from > to ? to : from || currentMonthStart;
  const rangeTo = from && to && from > to ? from : to || today;

  const filterMonthStart = `${filterMonth}-01`;
  const filterMonthEnd = endOfMonthISO(filterMonthStart);
  const filterMonthTo = filterMonthEnd > today ? today : filterMonthEnd;
  const isCurrentFilterMonth = filterMonth === today.slice(0, 7);

  const cur = state.property.currency;
  const loc = state.property.locale;
  const m = (n) => money(n, cur, loc);

  const assetOptions = useMemo(() => {
    const halls = (state.halls || []).map((h) => ({ id: `hall:${h.id}`, label: h.name }));
    const retreat = { id: "retreat", label: "The Royal Family Retreat" };
    const types = (state.roomTypes || [])
      .filter((t) => t.id !== "rt-retreat" && !/royal family retreat/i.test(t.name || ""))
      .map((t) => ({ id: `roomType:${t.id}`, label: t.name }));
    return [{ id: "all", label: "All" }, ...halls, retreat, ...types];
  }, [state.halls, state.roomTypes]);

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

  const todayBook = useMemo(() => cashbookReport(state, today, today), [state, today]);
  const periodBook = useMemo(() => cashbookReport(state, rangeFrom, rangeTo), [state, rangeFrom, rangeTo]);
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
    if (filterAsset === "all") return occupancyStats(state, today);
    if (filterAsset.startsWith("roomType:")) {
      const live = roomsInScope.filter((r) => !["Out of order", "Maintenance"].includes(r.status));
      const occupied = new Set(
        (state.roomReservations || [])
          .filter((r) => roomScopeIds.has(r.roomId) && roomOccupiesDate(r, today))
          .map((r) => r.roomId)
      ).size;
      return { occupied, live: live.length, occPct: live.length ? Math.round((occupied / live.length) * 100) : 0 };
    }
    return { occupied: 0, live: 0, occPct: 0 };
  }, [state, today, filterAsset, roomsInScope, roomScopeIds]);

  const todayHalls = useMemo(() => {
    let halls = (state.halls || []).filter((h) =>
      (state.hallReservations || []).some((r) => r.hallId === h.id && hallOccupiesDate(r, today))
    );
    if (filterAsset.startsWith("hall:")) {
      const hallId = filterAsset.slice(5);
      halls = halls.filter((h) => h.id === hallId);
    } else if (filterAsset === "retreat") {
      const retreatOn = (state.bookings || []).some(
        (b) =>
          isActiveBooking(b) &&
          bookingMatchesAsset(state, b.id, "retreat") &&
          ((b.eventDate || b.checkIn) <= today && (b.checkOut || b.eventDate || b.checkIn) >= today)
      );
      return retreatOn ? [{ id: "retreat", name: "The Royal Family Retreat" }] : [];
    } else if (filterAsset.startsWith("roomType:")) {
      return [];
    }
    return halls;
  }, [state, today, filterAsset]);

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

  const monthIncome = useMemo(
    () => paymentsIncome(state, filterMonthStart, filterMonthTo, filteredBookingIds),
    [state, filterMonthStart, filterMonthTo, filteredBookingIds]
  );
  const dayIncome = useMemo(() => paymentsIncome(state, today, today, filteredBookingIds), [state, today, filteredBookingIds]);
  const weekIncome = useMemo(
    () => paymentsIncome(state, weekStart, today, filteredBookingIds),
    [state, weekStart, today, filteredBookingIds]
  );
  const sixIncome = useMemo(
    () => paymentsIncome(state, sixMonthStart, today, filteredBookingIds),
    [state, sixMonthStart, today, filteredBookingIds]
  );
  const yearIncome = useMemo(
    () => paymentsIncome(state, yearStart, today, filteredBookingIds),
    [state, yearStart, today, filteredBookingIds]
  );

  const monthCashAll = useMemo(
    () => cashbookReport(state, filterMonthStart, filterMonthTo),
    [state, filterMonthStart, filterMonthTo]
  );
  const monthNet = filterAsset === "all" ? monthCashAll.net : monthIncome;

  const assetLabel = assetOptions.find((a) => a.id === filterAsset)?.label || "All";

  const hallHeadline =
    todayHalls.length === 0
      ? filterAsset.startsWith("roomType:")
        ? `${occ.occupied} occupied · ${availableToday} free`
        : filterAsset === "retreat"
          ? "Not booked today"
          : "No hall booked"
      : todayHalls.length === 1
        ? todayHalls[0].name
        : todayHalls.map((h) => h.name).join(" · ");
  const hallSub =
    todayHalls.length === 0
      ? filterAsset.startsWith("roomType:")
        ? `${assetLabel} · today`
        : filterAsset === "all"
          ? "Free today · all halls"
          : "Free today"
      : todayHalls.length === 1
        ? filterAsset === "all"
          ? "Event running · all halls"
          : "Event running"
        : `${todayHalls.length} events running`;

  const todayBookingCardTitle =
    filterAsset === "all"
      ? "Today's all booking"
      : filterAsset.startsWith("hall:")
        ? `Today's ${assetLabel}`
        : filterAsset === "retreat"
          ? "Today's Royal Family Retreat"
          : filterAsset.startsWith("roomType:")
            ? `Today's ${assetLabel}`
            : `Today's ${assetLabel}`;

  function setThisMonth() {
    setFrom(currentMonthStart);
    setTo(today);
  }

  function setTodayOnly() {
    setFrom(today);
    setTo(today);
  }

  return (
    <>
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
              value={filterMonth}
              onChange={setFilterMonth}
              today={today}
              bookedDays={bookedDaysInFilterMonth}
            />
          </div>
          <div className="dash-filter-assets">
            <span className="dash-filter-label">Function hall / rooms</span>
            <div className="dash-filter-chips">
              {assetOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`dash-chip${filterAsset === opt.id ? " on" : ""}`}
                  onClick={() => setFilterAsset(opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="muted dash-filter-note" style={{ marginTop: 10 }}>
              Showing overview for <strong>{monthShort(filterMonthStart)}</strong>
              {filterAsset !== "all" ? (
                <>
                  {" "}
                  · <strong>{assetLabel}</strong>
                </>
              ) : null}
              . Days with a booking mark are highlighted. Today / Period money below stay unfiltered.
            </p>
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
              <span className="dash-ov-k">Occupied today</span>
              <span className="dash-ov-v">{occ.occupied}</span>
            </div>
            <div className="dash-room-stat rs-free">
              <span className="dash-ov-k">Available today</span>
              <span className="dash-ov-v">{availableToday}</span>
            </div>
            <div className="dash-room-stat rs-in">
              <span className="dash-ov-k">Check-ins today</span>
              <span className="dash-ov-v">{checkInsToday}</span>
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
            <span className="dash-ov-k">Day wise</span>
            <span className="dash-ov-v">{m(dayIncome)}</span>
            <span className="dash-ov-s">Revenue · {formatDate(today)}</span>
          </div>
          <div className="dash-report-item">
            <span className="dash-ov-k">Week wise</span>
            <span className="dash-ov-v">{m(weekIncome)}</span>
            <span className="dash-ov-s">Revenue · last 7 days</span>
          </div>
          <div className="dash-report-item">
            <span className="dash-ov-k">Month wise</span>
            <span className="dash-ov-v">{m(monthIncome)}</span>
            <span className="dash-ov-s">Revenue · {monthLabel(filterMonthStart)}</span>
          </div>
          <div className="dash-report-item">
            <span className="dash-ov-k">6 months wise</span>
            <span className="dash-ov-v">{m(sixIncome)}</span>
            <span className="dash-ov-s">Revenue · since {formatDate(sixMonthStart)}</span>
          </div>
          <div className="dash-report-item">
            <span className="dash-ov-k">Yearly wise</span>
            <span className="dash-ov-v">{m(yearIncome)}</span>
            <span className="dash-ov-s">Revenue · {today.slice(0, 4)}</span>
          </div>
          <div className="dash-report-net">
            <span className="dash-ov-k">{filterAsset === "all" ? "Net profit (selected month)" : "Revenue (selection)"}</span>
            <span className="dash-ov-v">{m(monthNet)}</span>
            <span className="dash-ov-s">
              {filterAsset === "all" ? "After expenses" : "Payments for selection"} · {monthLabel(filterMonthStart)}
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
          <div className="v">{m(openAll.reduce((s, x) => s + x.totals.balance, 0))}</div>
          <div className="s">{openAll.length} open bills · not dated</div>
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
            <input type="date" value={rangeFrom} max={rangeTo} onChange={(e) => setFrom(e.target.value || currentMonthStart)} />
          </label>
          <label>
            To
            <input type="date" value={rangeTo} min={rangeFrom} max={today} onChange={(e) => setTo(e.target.value || today)} />
          </label>
          <button className="btn ghost small" type="button" onClick={setThisMonth}>
            This month
          </button>
          <button className="btn ghost small" type="button" onClick={setTodayOnly}>
            Today
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
    </>
  );
}
