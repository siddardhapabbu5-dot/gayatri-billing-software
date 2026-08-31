import { useState } from "react";
import { bookingFolio, hallDayStatus, hallOccupiesDate, occupancyStats, originLabel, revenueBreakdown, roomOccupiesDate } from "../engine";
import { addDays, formatDate, money, monthMatrix, pad, todayISO } from "../lib";
import { PageHead, Pill } from "../ui";

const WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function Dashboard({ state, go }) {
  const today = todayISO();
  const occ = occupancyStats(state, today);
  const rev = revenueBreakdown(state);
  const cur = state.property.currency;
  const loc = state.property.locale;
  const m = (n) => money(n, cur, loc);

  const folios = state.bookings.map((b) => ({ b, ...bookingFolio(state, b.id) }));
  const open = folios.filter((x) => x.totals.balance > 0 && !["Cancelled", "Refunded"].includes(x.b.status));
  const due = open.reduce((s, x) => s + x.totals.balance, 0);
  const paidFull = folios.filter((x) => x.totals.total > 0 && x.totals.balance <= 0).length;
  const partial = folios.filter((x) => x.totals.paid > 0 && x.totals.balance > 0).length;
  const pending = folios.filter((x) => x.totals.paid <= 0 && x.totals.total > 0).length;
  const payN = Math.max(1, paidFull + partial + pending);
  const paidPct = Math.round((paidFull / payN) * 100);
  const partPct = Math.round((partial / payN) * 100);
  const pendPct = Math.max(0, 100 - paidPct - partPct);

  const todayBooks = state.bookings.filter((b) => b.eventDate === today || String(b.createdAt || "").slice(0, 10) === today);
  const upcoming = [...state.bookings]
    .filter((b) => !["Cancelled", "Refunded"].includes(b.status) && b.eventDate >= today)
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate));
  const recent = [...state.bookings].slice(0, 6);
  const [calMonth, setCalMonth] = useState(upcoming[0]?.eventDate || today);
  const calDate = new Date(`${calMonth}T12:00:00`);
  const cells = monthMatrix(calDate.getFullYear(), calDate.getMonth());
  const monthLabel = calDate.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const todayPaid = state.payments
    .filter((p) => p.type !== "Refund" && String(p.at || p.date || "").slice(0, 10) === today)
    .reduce((s, p) => s + Number(p.amount || 0), 0);

  const rooms = {
    available: state.rooms.filter((r) => r.status === "Available" || r.status === "Inspected").length,
    occupied: state.rooms.filter((r) => r.status === "Occupied" || r.status === "Reserved").length,
    cleaning: state.rooms.filter((r) => r.status === "Dirty" || r.status === "Cleaning").length,
    maint: state.rooms.filter((r) => r.status === "Maintenance" || r.status === "Out of order").length,
  };

  const spark = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(today, i - 6);
    const v = state.payments
      .filter((p) => p.type !== "Refund" && String(p.at || p.date || "").slice(0, 10) === d)
      .reduce((s, p) => s + Number(p.amount || 0), 0);
    return { d, v };
  });
  const sparkMax = Math.max(1, ...spark.map((x) => x.v));
  const invoices = (state.invoices || []).slice(0, 6);

  function shiftCal(n) {
    const d = new Date(`${calMonth}T12:00:00`);
    d.setMonth(d.getMonth() + n);
    setCalMonth(todayISO(d));
  }

  function dayMarks(iso) {
    const halls = new Set(
      (state.hallReservations || [])
        .filter((r) => r.status !== "Cancelled" && hallOccupiesDate(r, iso))
        .map((r) => r.hallId)
    ).size;
    const rooms = new Set(
      (state.roomReservations || []).filter((r) => roomOccupiesDate(r, iso)).map((r) => r.roomId)
    ).size;
    const functions = state.bookings.filter(
      (b) => b.eventDate === iso && b.type !== "Room only" && !["Cancelled", "Refunded"].includes(b.status)
    ).length;
    return { halls, rooms, functions };
  }

  return (
    <>
      <PageHead title="Dashboard" sub={`${state.property.name} · ${formatDate(today)}`}>
        <button className="btn ghost" onClick={() => go("calendar")}>
          Calendar
        </button>
        <button className="btn" onClick={() => go("reserve")}>
          + New booking
        </button>
      </PageHead>

      <div className="kpis dash-kpis">
        <div className="kpi tone-a">
          <div className="k">Today's bookings</div>
          <div className="v">{todayBooks.length}</div>
          <div className="s">Events dated or created today</div>
        </div>
        <div className="kpi tone-b">
          <div className="k">Upcoming events</div>
          <div className="v">{upcoming.length}</div>
          <div className="s">Confirmed, quoted and enquiry</div>
        </div>
        <div className="kpi tone-c">
          <div className="k">Rooms occupied</div>
          <div className="v">
            {occ.occupied}/{occ.live}
          </div>
          <div className="s">{occ.occPct}% occupancy</div>
        </div>
        <div className="kpi tone-d">
          <div className="k">Today's collection</div>
          <div className="v">{m(todayPaid)}</div>
          <div className="s">Payments posted today</div>
        </div>
        <div className="kpi tone-e">
          <div className="k">Pending payments</div>
          <div className="v">{m(due)}</div>
          <div className="s">{open.length} open bills</div>
        </div>
      </div>

      <div className="dash-main">
        <div className="panel">
          <div className="cal-head">
            <button className="btn ghost small" type="button" onClick={() => shiftCal(-1)}>
              Previous
            </button>
            <div className="dash-month-wrap">
              <img className="dash-logo" src="/site/images/logo-gold.png" alt="" />
              <p className="dash-brand">{state.property.brandName || "Gayatri"}</p>
              <h3 className="dash-month">{monthLabel}</h3>
            </div>
            <div className="row">
              <button className="btn ghost small" type="button" onClick={() => shiftCal(1)}>
                Next
              </button>
              <button className="btn ghost small" type="button" onClick={() => go("calendar", { date: calMonth })}>
                Open
              </button>
            </div>
          </div>
          <div className="dash-cal">
            {WEEK.map((w) => (
              <div key={w} className="wd">
                {w}
              </div>
            ))}
            {cells.map((d, i) => {
              if (!d) return <div key={`e${i}`} className="empty" />;
              const iso = `${calDate.getFullYear()}-${pad(calDate.getMonth() + 1)}-${pad(d)}`;
              const { halls, rooms, functions } = dayMarks(iso);
              const hallMark = halls || functions;
              const on = iso === today;
              return (
                <button key={iso} type="button" className={on ? "on" : ""} onClick={() => go("calendar", { date: iso })}>
                  <strong>{d}</strong>
                  {hallMark > 0 && (
                    <span>{halls || functions} hall</span>
                  )}
                  {rooms > 0 && (
                    <span className="is-room">{rooms} room{rooms > 1 ? "s" : ""}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h3>Recent bookings</h3>
            <button className="btn ghost small" onClick={() => go("reserve")}>
              All
            </button>
          </div>
          <div className="dash-list">
            {recent.map((b) => {
              const g = state.guests.find((x) => x.id === b.guestId);
              const { totals } = bookingFolio(state, b.id);
              const hall = state.hallReservations.find((r) => r.bookingId === b.id);
              const hallName = state.halls.find((h) => h.id === hall?.hallId)?.name;
              return (
                <button key={b.id} type="button" className="dash-row" onClick={() => go("billing", { bookingId: b.id })}>
                  <div>
                    <strong>{g?.name || "Guest"}</strong>
                    <div className="muted">
                      {originLabel(b.source)} · {b.type} · {hallName || "Hall TBC"} · {formatDate(b.eventDate)}
                    </div>
                  </div>
                  <div className="dash-row-end">
                    <Pill status={b.status} />
                    <span>{m(totals.total)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="dash-mid">
        <div className="panel">
          <h3>Hall status</h3>
          {state.halls.map((h) => {
            const st = hallDayStatus(state, h.id, today);
            const slot = st.slots[0];
            return (
              <div key={h.id} className="hall-line">
                <img src={h.photo} alt="" />
                <div>
                  <strong>{h.name}</strong>
                  <div className="muted">
                    {slot
                      ? `${slot.guestName} · ${slot.source} · ${slot.windowLabel}`
                      : `Up to ${h.capacity.toLocaleString("en-IN")} guests`}
                  </div>
                </div>
                {st.booked ? <Pill status="Occupied">Booked</Pill> : <Pill status="Available" />}
              </div>
            );
          })}
        </div>

        <div className="panel">
          <h3>Room status</h3>
          <div className="room-stats">
            <div>
              <b>{rooms.available}</b>
              <span>Available</span>
            </div>
            <div>
              <b>{rooms.occupied}</b>
              <span>Occupied</span>
            </div>
            <div>
              <b>{rooms.cleaning}</b>
              <span>Cleaning</span>
            </div>
            <div>
              <b>{rooms.maint}</b>
              <span>Maintenance</span>
            </div>
          </div>
          <div className="occ-bar">
            <div className="occ-track">
              <i style={{ width: `${occ.occPct}%` }} />
            </div>
            <span>Overall occupancy {occ.occPct}%</span>
          </div>
        </div>

        <div className="panel">
          <h3>Collection (7 days)</h3>
          <div className="spark">
            {spark.map((x) => (
              <div key={x.d} title={`${formatDate(x.d)} · ${m(x.v)}`}>
                <i style={{ height: `${Math.max(8, (x.v / sparkMax) * 100)}%` }} />
              </div>
            ))}
          </div>
          <p className="muted">On books {m(rev.gross)} · Hall {m(rev.hall)} · Rooms {m(rev.room)}</p>
        </div>

        <div className="panel">
          <h3>Quick actions</h3>
          <div className="quick">
            {[
              ["New booking", "reserve"],
              ["Check hall dates", "calendar"],
              ["Create invoice", "billing"],
              ["Room rack", "rooms"],
              ["Add payment", "billing"],
              ["View reports", "reports"],
            ].map(([label, id]) => (
              <button key={id + label} type="button" onClick={() => go(id)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="dash-bot">
        <div className="panel">
          <div className="panel-head">
            <h3>Recent invoices</h3>
            <button className="btn ghost small" onClick={() => go("billing")}>
              Payment & Invoice
            </button>
          </div>
          {invoices.length === 0 ? (
            <div className="empty">No invoices yet.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Guest</th>
                  <th>Type</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const bk = state.bookings.find((b) => b.id === inv.bookingId);
                  const g = state.guests.find((x) => x.id === bk?.guestId);
                  return (
                    <tr key={inv.id} className="clickable" onClick={() => go("billing", { bookingId: inv.bookingId })}>
                      <td>{inv.number}</td>
                      <td>{g?.name || "—"}</td>
                      <td>{inv.type}</td>
                      <td>{formatDate(String(inv.at || inv.date || "").slice(0, 10))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="panel">
          <h3>Payment status</h3>
          <div className="pay-viz">
            <div
              className="donut"
              style={{
                background: `conic-gradient(#0f766e 0 ${paidPct}%, #b45309 ${paidPct}% ${paidPct + partPct}%, #b42318 ${paidPct + partPct}% 100%)`,
              }}
            />
            <ul>
              <li>
                <i className="ok" /> Paid {paidPct}% · {paidFull} bills
              </li>
              <li>
                <i className="warn" /> Partial {partPct}% · {partial} bills
              </li>
              <li>
                <i className="due" /> Pending {pendPct}% · {pending} bills
              </li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
