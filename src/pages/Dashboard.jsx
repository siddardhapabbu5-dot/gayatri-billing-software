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

function monthOptions(today) {
  const opts = [];
  let cursor = startOfMonthISO(parseISO(today));
  for (let i = 0; i < 18; i += 1) {
    opts.push({ value: cursor.slice(0, 7), label: monthShort(cursor) });
    cursor = startOfMonthISO(new Date(parseISO(cursor).getFullYear(), parseISO(cursor).getMonth() - 1, 1));
  }
  return opts;
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
  return (state.payments || [])
    .filter((p) => p.type !== "Refund" && p.type !== "Deposit return")
    .filter((p) => {
      const day = payDay(p);
      if (!day) return false;
      if (from && day < from) return false;
      if (to && day > to) return false;
      if (bookingIdSet && !bookingIdSet.has(p.bookingId)) return false;
      return true;
    })
    .reduce((s, p) => s + Number(p.amount || 0), 0);
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

  const monthOpts = useMemo(() => monthOptions(today), [today]);

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

  const hallHeadline =
    todayHalls.length === 0
      ? filterAsset.startsWith("roomType:")
        ? "—"
        : "No hall booked"
      : todayHalls.length === 1
        ? todayHalls[0].name
        : `${todayHalls.length} halls booked`;
  const hallSub =
    todayHalls.length === 0
      ? filterAsset.startsWith("roomType:")
        ? "Room filter active"
        : "Free today"
      : todayHalls.length === 1
        ? "Event running"
        : "Events running";

  const assetLabel = assetOptions.find((a) => a.id === filterAsset)?.label || "All";

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
        <div className="dash-filter-row">
          <label className="dash-filter-month">
            <span>Month</span>
            <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}>
              {monthOpts.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
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
          </div>
        </div>
        <p className="muted dash-filter-note">
          Showing overview for <strong>{monthShort(filterMonthStart)}</strong>
          {filterAsset !== "all" ? (
            <>
              {" "}
              · <strong>{assetLabel}</strong>
            </>
          ) : null}
          . Today / Period money below stay unfiltered.
        </p>
      </div>

      <div className="dash-overview-kpis">
        <button type="button" className="dash-ov-card tone-hall" onClick={() => go("calendar")}>
          <span className="dash-ov-k">Today&apos;s hall booking</span>
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
      </div>

      <h3 className="dash-section-title">Today</h3>
      <p className="muted" style={{ margin: "0 0 8px", maxWidth: 52 + "rem" }}>
        Money received today is one total. Rooms / hall / food below are only a split of that same money (from what is on each bill) — not separate payments.
      </p>
      <div className="kpis dash-kpis">
        <div className="kpi tone-d">
          <div className="k">Today money received</div>
          <div className="v">{m(todayBook.incomeTotal)}</div>
          <div className="s">All cash / UPI / card / bank today</div>
        </div>
        <div className="kpi tone-b">
          <div className="k">Of which · Rooms</div>
          <div className="v">{m(todayBook.room)}</div>
          <div className="s">Share for room charges on the bill</div>
        </div>
        <div className="kpi tone-a">
          <div className="k">Of which · Hall</div>
          <div className="v">{m(todayBook.hall)}</div>
          <div className="s">Share for hall charges on the bill</div>
        </div>
        <div className="kpi tone-c">
          <div className="k">Of which · Food &amp; extras</div>
          <div className="v">{m(todayBook.food + todayBook.otherIncome)}</div>
          <div className="s">Food, tea, laundry and other extras</div>
        </div>
        <div className="kpi tone-e">
          <div className="k">Today expenses</div>
          <div className="v">{m(todayBook.expenseTotal)}</div>
          <div className="s">From expense entry</div>
        </div>
        <div className="kpi tone-c">
          <div className="k">Today net</div>
          <div className="v">{m(todayBook.net)}</div>
          <div className="s">Money received − expenses</div>
        </div>
        <div className="kpi tone-e">
          <div className="k">Pending payments</div>
          <div className="v">{m(openAll.reduce((s, x) => s + x.totals.balance, 0))}</div>
          <div className="s">{openAll.length} open bills · not dated</div>
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
        Revenue, expenses and hall collections for <strong>{rangeLabel}</strong>.
      </p>
      <div className="kpis dash-kpis">
        <div className="kpi tone-b">
          <div className="k">Total revenue</div>
          <div className="v">{m(periodBook.incomeTotal)}</div>
          <div className="s">{rangeLabel}</div>
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
    </>
  );
}
