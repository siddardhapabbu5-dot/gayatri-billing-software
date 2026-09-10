import { useEffect, useMemo, useState } from "react";
import { hallDayStatus, roomOccupiesDate } from "../engine";
import { addDays, formatDate, monthMatrix, parseISO, pad, todayISO, weekDays } from "../lib";
import { PageHead, Pill } from "../ui";

const WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function slotWords(type) {
  if (type === "half-day") return "Half day";
  return "Full day";
}

function hallShort(hall) {
  return String(hall.name || hall.code || "Hall").split(" ")[0];
}

function weekdayLong(iso) {
  return parseISO(iso).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function hoverLines(m) {
  const lines = [];
  m.halls
    .filter((h) => h.booked)
    .forEach((h) => {
      h.slots.forEach((s) => {
        lines.push({
          kind: "hall",
          title: s.guestName || "Guest",
          body: [h.hall.name, slotWords(s.slotType), s.windowLabel, s.number].filter(Boolean).join(" · "),
        });
      });
    });
  m.rooms
    .filter((r) => r.busy)
    .forEach((r) => {
      lines.push({
        kind: "room",
        title: r.guest?.name || "Guest",
        body: `Room ${r.room.number} · ${formatDate(r.res.checkIn)} → ${formatDate(r.res.checkOut)}`,
      });
    });
  return lines;
}

function DayTip({ lines }) {
  if (!lines.length) return null;
  return (
    <span className="cal-tip" role="tooltip">
      {lines.map((line, i) => (
        <span key={`${line.kind}-${line.title}-${i}`} className={`cal-tip-row ${line.kind}`}>
          <b>{line.title}</b>
          <em>{line.body}</em>
        </span>
      ))}
    </span>
  );
}

function liveHalls(state) {
  return (state.halls || []).filter((h) => h.active !== false);
}

function marksOn(state, iso) {
  const halls = liveHalls(state).map((hall) => {
    const st = hallDayStatus(state, hall.id, iso);
    return { hall, booked: st.booked, slots: st.slots };
  });
  const rooms = (state.rooms || []).map((room) => {
    const res = (state.roomReservations || []).find((r) => r.roomId === room.id && roomOccupiesDate(r, iso));
    if (!res) {
      const closed = ["Maintenance", "Out of order"].includes(room.status);
      return {
        room,
        res: null,
        guest: null,
        label: room.status === "Maintenance" ? "Maintenance" : room.status === "Out of order" ? "Out of order" : "Free",
        busy: false,
        closed,
      };
    }
    const booking = state.bookings.find((b) => b.id === res.bookingId);
    const guest = state.guests.find((g) => g.id === res.guestId || g.id === booking?.guestId);
    return {
      room,
      res,
      guest,
      booking,
      label: res.status === "Reserved" ? "Reserved" : "Occupied",
      busy: true,
    };
  });
  return {
    halls,
    rooms,
    hallN: halls.filter((h) => h.booked).length,
    roomN: rooms.filter((r) => r.busy).length,
  };
}

export default function Calendar({ state, go, focusDate }) {
  const today = todayISO();
  const [view, setView] = useState("month");
  const [cursor, setCursor] = useState(focusDate || today);

  // Always land on today when opened without a specific date (stays current month).
  useEffect(() => {
    setCursor(focusDate || todayISO());
  }, [focusDate]);

  const d = parseISO(cursor);
  const cells = monthMatrix(d.getFullYear(), d.getMonth());
  const week = weekDays(cursor);
  const monthTitle = d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const selected = useMemo(() => marksOn(state, cursor), [state, cursor]);
  const halls = liveHalls(state);

  function shift(n) {
    if (view === "week") {
      setCursor(addDays(cursor, n * 7));
      return;
    }
    const next = parseISO(cursor);
    const day = next.getDate();
    next.setDate(1);
    next.setMonth(next.getMonth() + n);
    const last = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    next.setDate(Math.min(day, last));
    setCursor(todayISO(next));
  }

  return (
    <>
      <PageHead title="Calendar" sub="Hover a date to see booking times. Click it for full details.">
        <div className="tabs">
          <button type="button" className={view === "month" ? "on" : ""} onClick={() => setView("month")}>
            Month
          </button>
          <button type="button" className={view === "week" ? "on" : ""} onClick={() => setView("week")}>
            This week
          </button>
        </div>
        <button className="btn ghost" type="button" onClick={() => setCursor(today)}>
          Today
        </button>
        <button className="btn" type="button" onClick={() => go("reserve", { date: cursor })}>
          New booking
        </button>
      </PageHead>

      {/* Phone-only compact calendar */}
      <section className="staff-m-cal" aria-label="Phone calendar">
        <div className="staff-m-cal-nav">
          <button type="button" className="staff-m-icon-btn" aria-label="Previous" onClick={() => shift(-1)}>
            ‹
          </button>
          <strong>{view === "week" ? `Week of ${formatDate(week[0])}` : monthTitle}</strong>
          <button type="button" className="staff-m-icon-btn" aria-label="Next" onClick={() => shift(1)}>
            ›
          </button>
        </div>
        <div className="staff-m-asset-row" role="tablist" aria-label="Dates">
          {week.map((iso) => {
            const day = parseISO(iso);
            const m = marksOn(state, iso);
            const busy = m.hallN + m.roomN > 0;
            return (
              <button
                key={iso}
                type="button"
                role="tab"
                aria-selected={iso === cursor}
                className={`staff-m-cal-day${iso === cursor ? " on" : ""}${iso === today ? " today" : ""}${busy ? " busy" : ""}`}
                onClick={() => setCursor(iso)}
              >
                <b>{day.getDate()}</b>
                <span>{WEEK[day.getDay()].slice(0, 3)}</span>
              </button>
            );
          })}
        </div>
        <h3 className="staff-m-sec">Day&apos;s Events</h3>
        <div className="staff-m-book-list">
          {selected.halls
            .filter((h) => h.booked)
            .flatMap(({ hall, slots }) =>
              (slots.length ? slots : [{}]).map((slot, i) => (
                <button
                  key={`${hall.id}-${i}`}
                  type="button"
                  className="staff-m-book-card"
                  onClick={() => (slot.bookingId ? go("billing", { bookingId: slot.bookingId }) : go("reserve", { date: cursor }))}
                >
                  <span className="hall">{hall.name}</span>
                  <span className="title">{slot.guestName || slot.occasion || "Function"}</span>
                  <span className="meta">
                    {[slotWords(slot.slotType), slot.windowLabel].filter(Boolean).join(" · ") || "Booked"}
                  </span>
                  <span className="foot">
                    <span className="staff-m-status is-ok">Confirmed</span>
                    <span aria-hidden="true">›</span>
                  </span>
                </button>
              ))
            )}
          {selected.rooms
            .filter((r) => r.busy)
            .map(({ room, res, guest, label, booking }) => (
              <button
                key={room.id}
                type="button"
                className="staff-m-book-card"
                onClick={() => (booking?.id || res?.bookingId ? go("billing", { bookingId: booking?.id || res.bookingId }) : go("rooms"))}
              >
                <span className="hall">Room {room.number}</span>
                <span className="title">{guest?.name || "Guest"}</span>
                <span className="meta">
                  {formatDate(res.checkIn)} → {formatDate(res.checkOut)}
                </span>
                <span className="foot">
                  <span className={`staff-m-status ${label === "Reserved" ? "is-warn" : "is-ok"}`}>{label}</span>
                  <span aria-hidden="true">›</span>
                </span>
              </button>
            ))}
          {!selected.hallN && !selected.roomN ? (
            <div className="staff-m-empty">
              <p>No events on this date.</p>
              <button type="button" className="btn" onClick={() => go("reserve", { date: cursor })}>
                Create Booking
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <div className="cal-easy staff-desk-cal">
        <div className="panel">
          <div className="cal-head">
            <button className="btn ghost small" type="button" onClick={() => shift(-1)}>
              Previous
            </button>
            <div className="dash-month-wrap">
              <img className="dash-logo" src="/site/images/logo-gold.png" alt="" />
              <p className="dash-brand">{state.property.brandName || "Gayatri"}</p>
              <h3 className="dash-month">{view === "week" ? `Week of ${formatDate(week[0])}` : monthTitle}</h3>
            </div>
            <button className="btn ghost small" type="button" onClick={() => shift(1)}>
              Next
            </button>
          </div>

          {view === "month" && (
            <div className="cal-month">
              {WEEK.map((w) => (
                <div key={w} className="wd">
                  {w}
                </div>
              ))}
              {cells.map((day, i) => {
                if (!day) return <div key={`e${i}`} className="cal-day is-empty" />;
                const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(day)}`;
                const m = marksOn(state, iso);
                const tips = hoverLines(m);
                const col = i % 7;
                const edge = col === 0 ? "is-sun" : col === 6 ? "is-sat" : "";
                return (
                  <button
                    key={iso}
                    type="button"
                    className={`cal-day${iso === cursor ? " is-on" : ""}${iso === today ? " is-today" : ""}${tips.length ? " has-tip" : ""}${edge ? ` ${edge}` : ""}`}
                    onClick={() => setCursor(iso)}
                    aria-label={tips.length ? `${day}. ${tips.map((t) => `${t.title}: ${t.body}`).join(". ")}` : `${day}. Nothing booked`}
                  >
                    <strong>{day}</strong>
                    {m.halls
                      .filter((h) => h.booked)
                      .map((h) => (
                        <span key={h.hall.id} className="cal-chip hall">
                          {hallShort(h.hall)}
                        </span>
                      ))}
                    {m.roomN > 0 && (
                      <span className="cal-chip room">
                        {m.roomN} room{m.roomN > 1 ? "s" : ""}
                      </span>
                    )}
                    <DayTip lines={tips} />
                  </button>
                );
              })}
            </div>
          )}

          {view === "week" && (
            <div className="cal-week-wrap">
              <div className="cal-week">
              <div className="h"> </div>
              {week.map((iso) => (
                <button
                  key={iso}
                  type="button"
                  className={`h cal-week-d${iso === cursor ? " is-on" : ""}`}
                  onClick={() => setCursor(iso)}
                >
                  {WEEK[parseISO(iso).getDay()]}
                  <b>{parseISO(iso).getDate()}</b>
                </button>
              ))}
              {halls.map((hall) => (
                <WeekHallRow key={hall.id} hall={hall} week={week} cursor={cursor} state={state} onPick={setCursor} />
              ))}
              <div className="h">Rooms</div>
              {week.map((iso) => {
                const m = marksOn(state, iso);
                const n = m.roomN;
                const tips = hoverLines({ halls: [], rooms: m.rooms, hallN: 0, roomN: n });
                return (
                  <button
                    key={iso}
                    type="button"
                    className={`c${n ? " is-room has-tip" : " is-free"}`}
                    onClick={() => setCursor(iso)}
                  >
                    {n ? `${n} occupied` : "All free"}
                    <DayTip lines={tips} />
                  </button>
                );
              })}
              </div>
            </div>
          )}
        </div>

        <DayPanel state={state} iso={cursor} marks={selected} go={go} />
      </div>
    </>
  );
}

function WeekHallRow({ hall, week, cursor, state, onPick }) {
  return (
    <>
      <div className="h">{hallShort(hall)}</div>
      {week.map((iso) => {
        const st = hallDayStatus(state, hall.id, iso);
        const slot = st.slots[0];
        const tips = st.booked
          ? [
              {
                kind: "hall",
                title: hall.name,
                body: [slot?.guestName || "Guest", slotWords(slot?.slotType), slot?.windowLabel].filter(Boolean).join(" · "),
              },
            ]
          : [];
        return (
          <button
            key={iso}
            type="button"
            className={`c${st.booked ? " is-busy has-tip" : " is-free"}${iso === cursor ? " is-on" : ""}`}
            onClick={() => onPick(iso)}
          >
            {st.booked ? (
              <>
                <b>Booked</b>
                <span>{slot?.guestName || slotWords(slot?.slotType)}</span>
              </>
            ) : (
              <span>Free</span>
            )}
            <DayTip lines={tips} />
          </button>
        );
      })}
    </>
  );
}

function DayPanel({ state, iso, marks, go }) {
  const bookedHalls = marks.halls.filter((h) => h.booked);
  const busyRooms = marks.rooms.filter((r) => r.busy);
  const freeHalls = marks.halls.filter((h) => !h.booked).length;
  const freeRooms = marks.rooms.filter((r) => !r.busy && r.label === "Free").length;
  const maintRooms = marks.rooms.filter((r) => r.label === "Maintenance");
  const oooRooms = marks.rooms.filter((r) => r.label === "Out of order");

  return (
    <div className="panel cal-detail">
      <p className="muted" style={{ margin: 0 }}>
        Selected date
      </p>
      <h3>{weekdayLong(iso)}</h3>
      <p className="cal-sum">
        {bookedHalls.length
          ? `${bookedHalls.length} hall${bookedHalls.length > 1 ? "s" : ""} booked`
          : "No hall booked"}
        {" · "}
        {busyRooms.length
          ? `${busyRooms.length} room${busyRooms.length > 1 ? "s" : ""} occupied`
          : "No room occupied"}
      </p>

      <div className="cal-block">
        <h4>Convention halls</h4>
        {marks.halls.map(({ hall, booked, slots }) => {
          const slot = slots[0];
          return (
            <div key={hall.id} className="cal-row">
              <div>
                <strong>{hall.name}</strong>
                {booked && slot ? (
                  <div className="who">
                    {slot.guestName || "Guest"} · {slotWords(slot.slotType)}
                    {slot.windowLabel ? ` · ${slot.windowLabel}` : ""}
                  </div>
                ) : (
                  <div className="who">Available this day</div>
                )}
              </div>
              <Pill status={booked ? "Confirmed" : "Available"}>{booked ? "Booked" : "Free"}</Pill>
            </div>
          );
        })}
        {freeHalls === marks.halls.length && marks.halls.length > 0 && (
          <p className="muted" style={{ margin: "8px 0 0" }}>
            All halls are free. You can take a function booking.
          </p>
        )}
      </div>

      <div className="cal-block">
        <h4>Guest rooms</h4>
        {busyRooms.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            No guest in a room this night. {freeRooms} rooms free.
          </p>
        ) : (
          busyRooms.map(({ room, res, guest, label }) => (
            <div key={room.id} className="cal-row">
              <div>
                <strong>Room {room.number}</strong>
                <div className="who">
                  {guest?.name || "Guest"} · {formatDate(res.checkIn)} → {formatDate(res.checkOut)}
                </div>
              </div>
              <Pill status={label}>{label}</Pill>
            </div>
          ))
        )}
        {busyRooms.length > 0 && (
          <p className="muted" style={{ margin: "8px 0 0" }}>
            {freeRooms} other room{freeRooms === 1 ? "" : "s"} free
          </p>
        )}
        {(maintRooms.length > 0 || oooRooms.length > 0) && (
          <div className="cal-closed-list" style={{ marginTop: 12 }}>
            {maintRooms.map(({ room }) => (
              <div key={room.id} className="cal-row cal-row-maint">
                <div>
                  <strong>Room {room.number}</strong>
                  <div className="who">Under maintenance — not for sale</div>
                </div>
                <Pill status="Maintenance">Maintenance</Pill>
              </div>
            ))}
            {oooRooms.map(({ room }) => (
              <div key={room.id} className="cal-row">
                <div>
                  <strong>Room {room.number}</strong>
                  <div className="who">Out of order</div>
                </div>
                <Pill status="Out of order">Out of order</Pill>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="cal-actions">
        <button className="btn" type="button" onClick={() => go("reserve", { date: iso })}>
          Book this date
        </button>
        <button className="btn ghost" type="button" onClick={() => go("rooms")}>
          Room board
        </button>
      </div>
    </div>
  );
}
