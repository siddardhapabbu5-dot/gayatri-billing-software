import { useMemo, useState } from "react";
import { addDays, formatDateDMY, money, nightsBetween, telHref, todayISO, waMe } from "../lib";
import { buildFolioLinesFromDraft, folioTotals, hallDayStatus, lineKind, originLabel, roomClash } from "../engine";
import { housekeepingOf, occupancyOf, policiesOf, roomCheckInOutText, suggestedAdvance } from "../policies";
import { requiredFromDraft } from "../docTypes";
import { DEFAULT_EVENT_TYPES } from "../seed";
import { PageHead, Pill } from "../ui";
import DocPanel from "./DocPanel.jsx";

const CLOSED_OCC = new Set(["Maintenance", "Out of order"]);
const CLOSED_HK = new Set(["Dirty", "Cleaning"]);

function stayOnDates(state, roomId, checkIn, checkOut) {
  return roomClash(state.roomReservations || [], roomId, checkIn, checkOut);
}

function roomChipLabel(room, stay) {
  if (stay) return stay.status === "Occupied" ? "Occupied" : "Reserved";
  const occ = occupancyOf(room);
  if (CLOSED_OCC.has(occ)) return occ;
  const hk = housekeepingOf(room);
  if (CLOSED_HK.has(hk) || hk === "Inspected") return hk;
  return "Available";
}

function roomOccupant(state, roomId, checkIn, checkOut) {
  const room = state.rooms.find((r) => r.id === roomId);
  const stay = stayOnDates(state, roomId, checkIn, checkOut);
  const booking = state.bookings.find((b) => b.id === stay?.bookingId);
  const guest = state.guests.find((g) => g.id === stay?.guestId || g.id === booking?.guestId);
  const type = state.roomTypes.find((t) => t.id === room?.typeId);
  return { room, stay, booking, guest, type };
}

function eventTypeOptions(property) {
  const fromProp = (property?.eventTypes || DEFAULT_EVENT_TYPES).filter(Boolean);
  const tail = ["Room only"].filter((t) => !fromProp.includes(t));
  return [...fromProp, ...tail];
}

function defaultEventType(property) {
  const types = eventTypeOptions(property);
  return types.find((t) => t !== "Room only" && t !== "Other") || types[0] || "Conference";
}

function emptyDraft(property, date) {
  const day = date || todayISO();
  return {
    guest: { name: "", phone: "", email: "", address: "", gstin: "", nationality: "India", idProof: { type: "Aadhaar", number: "" } },
    type: defaultEventType(property),
    source: "Direct",
    eventDate: day,
    checkIn: day,
    checkOut: addDays(day, 1),
    guestsExpected: 200,
    packageId: "",
    halls: [],
    rooms: [],
    services: [],
    discount: 0,
    gstMode: "with",
    advance: 0,
    paymentMode: "UPI",
    paymentDate: todayISO(),
    paymentRef: "",
    finalPayment: 0,
    finalPaymentMode: "UPI",
    finalPaymentDate: todayISO(),
    finalPaymentRef: "",
    notes: "",
    pendingDocs: [],
    agreeHall: false,
    agreeRoom: false,
  };
}

const EMPTY = emptyDraft(null);

function stayNights(checkIn, checkOut) {
  return Math.max(1, nightsBetween(checkIn, checkOut) || 1);
}

function draftFromGuest(property, guest, date) {
  const base = emptyDraft(property, date);
  return {
    ...base,
    guest: guest
      ? {
          name: guest.name || "",
          phone: guest.phone || "",
          email: guest.email || "",
          address: guest.address || "",
          gstin: guest.gstin || "",
          nationality: guest.nationality || "India",
          idProof: guest.idProof || { type: "Aadhaar", number: "" },
        }
      : base.guest,
  };
}

function roomSaleBlocked(room) {
  const occ = occupancyOf(room);
  if (CLOSED_OCC.has(occ)) return occ;
  const hk = housekeepingOf(room);
  if (CLOSED_HK.has(hk)) return hk;
  return null;
}

function applyHallSlotWindow(h, date) {
  const slotType = h.slotType === "hourly" ? "half-day" : h.slotType;
  if (slotType === "half-day") {
    return {
      ...h,
      date,
      slotType,
      start: `${date}T18:00`,
      end: `${addDays(date, 1)}T00:00`,
    };
  }
  return {
    ...h,
    date,
    slotType: "full-day",
    start: `${date}T06:00`,
    end: `${addDays(date, 1)}T06:00`,
  };
}

function BookingWorkflow({ step, go, bookingId, guestId }) {
  const items = [
    { n: 1, label: "Reservations", page: "reserve" },
    { n: 2, label: "Payment & Invoice", page: "billing", bookingId },
    { n: 3, label: "Guests / CRM", page: "guests", guestId },
    { n: 4, label: "Documents", page: "documents", bookingId },
  ];
  return (
    <nav className="booking-workflow" aria-label="Staff booking process — not a live booking record">
      <p className="booking-workflow-caption muted">Staff process: Reservations → Payment → CRM → Documents</p>
      {items.map((item, i) => (
        <span key={item.n} className="booking-workflow-item">
          {i > 0 && <span className="booking-workflow-arrow">→</span>}
          <button
            type="button"
            className={`booking-workflow-step${step === item.n ? " is-current" : step > item.n ? " is-done" : ""}`}
            disabled={item.n > 1 && !bookingId && item.page !== "guests"}
            onClick={() => {
              if (item.page === "billing" && bookingId) go("billing", { bookingId });
              else if (item.page === "guests" && guestId) go("guests", { guestId });
              else if (item.page === "documents" && bookingId) go("documents", { bookingId });
              else if (item.page === "reserve") go("reserve");
            }}
          >
            <em>{item.n}</em>
            {item.label}
          </button>
        </span>
      ))}
    </nav>
  );
}

export default function Reservations({ state, presetDate, presetGuest, onSave, onCancel, onOpen, onDocs, go }) {
  const startDate = presetDate || todayISO();
  const [mode, setMode] = useState(presetGuest ? "form" : "list");
  const [listTab, setListTab] = useState("active");
  const [draft, setDraft] = useState(() => draftFromGuest(state.property, presetGuest, startDate));
  const [error, setError] = useState("");
  const [peekRoom, setPeekRoom] = useState(null);
  const eventOptions = useMemo(() => eventTypeOptions(state.property), [state.property.eventTypes]);
  const lines = useMemo(() => buildFolioLinesFromDraft(state, { ...draft, services: draft.services }), [state, draft]);
  const previewPays = [
    ...(Number(draft.advance) > 0 ? [{ amount: Number(draft.advance) || 0, type: "Advance" }] : []),
    ...(Number(draft.finalPayment) > 0 ? [{ amount: Number(draft.finalPayment) || 0, type: "Final" }] : []),
  ];
  const taxRate = draft.gstMode === "without" ? 0 : state.property.taxPercent;
  const totals = folioTotals({ discount: draft.discount, gstMode: draft.gstMode }, lines, previewPays, taxRate);
  const pol = policiesOf(state.property);
  const cur = state.property.currency;
  const loc = state.property.locale;

  function toggleHall(id) {
    const hall = state.halls.find((h) => h.id === id);
    const date = draft.eventDate;
    const hold = hallDayStatus(state, id, date);
    if (hold.booked) {
      const w = hold.slots[0];
      setError(
        w
          ? `${hall?.name} is booked on ${formatDateDMY(date)} (${w.windowLabel || w.slotType}). Pick another hall or date.`
          : `${hall?.name} is not free on ${formatDateDMY(date)}.`
      );
      return;
    }
    setError("");
    setDraft((d) => {
      const found = d.halls.find((h) => h.hallId === id);
      if (found) return { ...d, halls: d.halls.filter((h) => h.hallId !== id) };
      return {
        ...d,
        halls: [
          ...d.halls,
          applyHallSlotWindow({ hallId: id, slotType: "full-day", start: "", end: "" }, date),
        ],
        type: d.type === "Room only" ? defaultEventType(state.property) : d.type,
      };
    });
  }

  function patchHall(id, patch) {
    setDraft((d) => ({
      ...d,
      halls: d.halls.map((h) => {
        if (h.hallId !== id) return h;
        let next = { ...h, ...patch };
        if (patch.date) {
          next = applyHallSlotWindow({ ...next, slotType: next.slotType }, patch.date);
        } else if (patch.slotType === "half-day") {
          next = applyHallSlotWindow({ ...next, slotType: "half-day" }, next.date);
        } else if (patch.slotType === "full-day") {
          next = applyHallSlotWindow({ ...next, slotType: "full-day" }, next.date);
        }
        return next;
      }),
    }));
  }

  function setEventDate(date) {
    // Hall event date can differ from room check-in / check-out.
    setDraft((d) => ({
      ...d,
      eventDate: date,
      halls: d.halls.map((h) => applyHallSlotWindow(h, date)),
    }));
  }

  function toggleRoom(id) {
    const room = state.rooms.find((r) => r.id === id);
    const checkIn = draft.checkIn || draft.eventDate;
    const checkOut = draft.checkOut || addDays(checkIn, 1);
    if (stayOnDates(state, id, checkIn, checkOut)) {
      setPeekRoom(id);
      return;
    }
    const blocked = roomSaleBlocked(room);
    if (blocked) {
      setError(`Room ${room?.number} is ${blocked}. Choose an Available or Inspected room.`);
      setPeekRoom(id);
      return;
    }
    setDraft((d) => {
      if (d.rooms.length === 1 && d.rooms[0].roomId === id) return d;
      return {
        ...d,
        rooms: [{
          roomId: id,
          checkIn: d.checkIn || d.eventDate,
          checkOut: d.checkOut || addDays(d.checkIn || d.eventDate, 1),
          adults: 2,
          children: 0,
          extraBed: 0,
        }],
      };
    });
    setPeekRoom(id);
  }

  function patchRoom(id, patch) {
    setDraft((d) => {
      const rooms = d.rooms.map((r) => (r.roomId === id ? { ...r, ...patch } : r));
      const row = rooms.find((r) => r.roomId === id);
      if (patch.checkIn || patch.checkOut) {
        const checkIn = row.checkIn;
        const checkOut = row.checkOut <= row.checkIn ? addDays(row.checkIn, 1) : row.checkOut;
        return {
          ...d,
          checkIn,
          checkOut,
          rooms: rooms.map((r) => ({ ...r, checkIn, checkOut })),
        };
      }
      return { ...d, rooms };
    });
  }

  function setStay(patch) {
    setDraft((d) => {
      let checkIn = patch.checkIn ?? d.checkIn ?? d.eventDate;
      let checkOut = patch.checkOut ?? d.checkOut ?? addDays(checkIn, 1);
      if (patch.nights != null) {
        checkOut = addDays(checkIn, Math.max(1, Number(patch.nights) || 1));
      }
      if (checkOut <= checkIn) checkOut = addDays(checkIn, 1);
      return {
        ...d,
        checkIn,
        checkOut,
        rooms: d.rooms.map((r) => ({ ...r, checkIn, checkOut })),
      };
    });
  }

  function dropRoom(id) {
    setDraft((d) => ({ ...d, rooms: d.rooms.filter((r) => r.roomId !== id) }));
    setPeekRoom((cur) => (cur === id ? null : cur));
  }

  function submit(e) {
    e.preventDefault();
    setError("");
    const phone = String(draft.guest.phone || "").trim();
    if (!draft.guest.name?.trim() || !phone) {
      setError("Guest name and phone are required.");
      return;
    }
    if (!/^[0-9+\-\s]{10,15}$/.test(phone)) {
      setError("Enter a valid phone number (10–15 digits).");
      return;
    }
    if (!draft.halls.length && !draft.rooms.length) {
      setError("Select at least one hall or room.");
      return;
    }
    for (const h of draft.halls) {
      const hall = state.halls.find((x) => x.id === h.hallId);
      const hold = hallDayStatus(state, h.hallId, h.date);
      if (hold.booked) {
        const w = hold.slots[0];
        setError(
          w
            ? `${hall?.name} is already booked on ${formatDateDMY(h.date)} (${w.windowLabel || w.slotType}).`
            : `${hall?.name} is not available on ${formatDateDMY(h.date)}.`
        );
        return;
      }
    }
    for (const r of draft.rooms) {
      if (r.checkOut <= r.checkIn) {
        setError("Room check-out must be after check-in.");
        return;
      }
      if (stayOnDates(state, r.roomId, r.checkIn, r.checkOut)) {
        const room = state.rooms.find((x) => x.id === r.roomId);
        setError(`Room ${room?.number} is already held for those dates.`);
        return;
      }
    }
    if (draft.halls.length && !draft.agreeHall) {
      setError("Tick the Convention Terms & Conditions for hall bookings.");
      return;
    }
    if (draft.rooms.length && !draft.agreeRoom) {
      setError("Tick the Room Booking Terms & Conditions for room stay.");
      return;
    }
    const out = onSave({ ...draft, lines });
    if (out?.error) setError(out.error);
    else setMode("list");
  }

  const activeRows = state.bookings.filter((b) => b.status !== "Cancelled");
  const cancelledRows = state.bookings.filter((b) => b.status === "Cancelled");
  const rows = listTab === "cancelled" ? cancelledRows : activeRows;

  if (mode === "form") {
    return (
      <>
        <BookingWorkflow step={1} go={go} />
        <PageHead title="New reservation" sub="Step 1 — Fill guest details, select Imperial / hall, agree terms → Confirm. Then Step 2 Payment & Invoice, Step 3 Guests / CRM.">
          <button className="btn ghost" onClick={() => { setPeekRoom(null); setMode("list"); }}>Back</button>
        </PageHead>
        <form className="form" onSubmit={submit}>
          <div className="panel">
            <h3>Guest</h3>
            <div className="fields">
              <label>Name<input value={draft.guest.name} onChange={(e) => setDraft({ ...draft, guest: { ...draft.guest, name: e.target.value } })} /></label>
              <label>Phone<input value={draft.guest.phone} onChange={(e) => setDraft({ ...draft, guest: { ...draft.guest, phone: e.target.value } })} /></label>
              <label>Customer GST
                <input
                  value={draft.guest.gstin || ""}
                  onChange={(e) => setDraft({ ...draft, guest: { ...draft.guest, gstin: e.target.value } })}
                  placeholder="GSTIN if billed to a company"
                />
              </label>
              <label>Event
                <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>
                  {eventOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label>Source
                <select value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })}>
                  {["Direct", "Walk-in", "Website", "Corporate", "Group", "Online"].map((t) => <option key={t}>{t}</option>)}
                </select>
              </label>
              <label>Event date<input type="date" value={draft.eventDate} min={todayISO()} onChange={(e) => setEventDate(e.target.value)} /></label>
              <label>Nationality
                <select value={draft.guest.nationality} onChange={(e) => setDraft({ ...draft, guest: { ...draft.guest, nationality: e.target.value } })}>
                  <option>India</option>
                  <option>Other</option>
                </select>
              </label>
              <label>ID type
                <select
                  value={draft.guest.idProof?.type || "Aadhaar"}
                  onChange={(e) => setDraft({ ...draft, guest: { ...draft.guest, idProof: { ...draft.guest.idProof, type: e.target.value } } })}
                >
                  {["Aadhaar", "Passport", "Driving licence", "Voter ID", "PAN"].map((t) => <option key={t}>{t}</option>)}
                </select>
              </label>
              <label>ID number
                <input
                  value={draft.guest.idProof?.number || ""}
                  onChange={(e) => setDraft({ ...draft, guest: { ...draft.guest, idProof: { ...draft.guest.idProof, number: e.target.value } } })}
                />
              </label>
              <label>Expected guests<input type="number" value={draft.guestsExpected} onChange={(e) => setDraft({ ...draft, guestsExpected: e.target.value })} /></label>
            </div>
          </div>
          <div className="panel">
            <h3>Halls</h3>
            <p className="muted">Convention halls. Half-day or full-day. Hall date can be different from room stay dates.</p>
            <div className="hall-tariff-grid">
              {state.halls.filter((h) => h.active !== false).map((h) => {
                const selected = draft.halls.some((x) => x.hallId === h.id);
                const hold = hallDayStatus(state, h.id, draft.eventDate);
                const booked = hold.booked;
                return (
                  <button
                    type="button"
                    key={h.id}
                    className={`hall-tariff-card${selected ? " on" : ""}${booked ? " is-held" : ""}`}
                    disabled={booked && !selected}
                    onClick={() => toggleHall(h.id)}
                  >
                    <strong>{h.name}</strong>
                    {booked && !selected ? (
                      <span className="hall-tariff-hold">Booked on {formatDateDMY(draft.eventDate)}</span>
                    ) : null}
                    <div className="hall-tariff-lines">
                      <span>
                        <em>Half day</em>
                        {money(h.rates.halfDay, cur, loc)}
                      </span>
                      <span>
                        <em>Full day</em>
                        {money(h.rates.fullDay, cur, loc)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
            {draft.halls.map((h) => {
              const hall = state.halls.find((x) => x.id === h.hallId);
              const slotType = h.slotType === "hourly" ? "half-day" : h.slotType;
              const slotRate = slotType === "half-day" ? hall?.rates?.halfDay : hall?.rates?.fullDay;
              const slotLabel = slotType === "half-day" ? "Half day" : "Full day";
              return (
                <div className="fields" key={h.hallId} style={{ marginTop: 10 }}>
                  <label>{hall.name} date<input type="date" value={h.date} onChange={(e) => patchHall(h.hallId, { date: e.target.value })} /></label>
                  <label>Slot
                    <select value={slotType} onChange={(e) => patchHall(h.hallId, { slotType: e.target.value })}>
                      <option value="half-day">Half day · {money(hall.rates.halfDay, cur, loc)}</option>
                      <option value="full-day">Full day 24h · {money(hall.rates.fullDay, cur, loc)}</option>
                    </select>
                  </label>
                  <p className="hall-slot-rate muted">
                    {slotLabel} package: <strong>{money(slotRate, cur, loc)}</strong>
                  </p>
                  <label>Window
                    <div className="row">
                      <input type="datetime-local" value={h.start} onChange={(e) => patchHall(h.hallId, { start: e.target.value })} />
                      <input type="datetime-local" value={h.end} onChange={(e) => patchHall(h.hallId, { end: e.target.value })} />
                    </div>
                  </label>
                </div>
              );
            })}
          </div>
          <div className="panel">
            <h3>Room stay</h3>
            <p className="muted">
              Room stay dates are separate from the hall event date — set check-in / check-out below.
              Occupied or Reserved only if a guest is already booked for these dates. Then click a free room.
              Check-in / check-out: {roomCheckInOutText(pol)}.
            </p>
            <div className="fields">
              <label>
                Check-in
                <input type="date" value={draft.checkIn || draft.eventDate} onChange={(e) => setStay({ checkIn: e.target.value })} />
              </label>
              <label>
                Check-out
                <input type="date" value={draft.checkOut || addDays(draft.checkIn || draft.eventDate, 1)} onChange={(e) => setStay({ checkOut: e.target.value })} />
              </label>
              <label>
                Nights
                <input
                  type="number"
                  min="1"
                  value={stayNights(draft.checkIn || draft.eventDate, draft.checkOut || addDays(draft.checkIn || draft.eventDate, 1))}
                  onChange={(e) => setStay({ nights: e.target.value })}
                />
              </label>
            </div>
            <div className="chips">
              {state.rooms.map((r) => {
                const checkIn = draft.checkIn || draft.eventDate;
                const checkOut = draft.checkOut || addDays(checkIn, 1);
                const stay = stayOnDates(state, r.id, checkIn, checkOut);
                const label = roomChipLabel(r, stay);
                const held = Boolean(stay);
                const selected = draft.rooms.some((x) => x.roomId === r.id);
                return (
                  <button
                    type="button"
                    key={r.id}
                    className={`chip${selected ? " on" : ""}${held ? " held" : ""}${peekRoom === r.id ? " peek" : ""}`}
                    onClick={() => toggleRoom(r.id)}
                  >
                    {r.number} {label}
                  </button>
                );
              })}
            </div>
            {peekRoom && draft.rooms.some((r) => r.roomId === peekRoom) && (
              <RoomStayEditor
                state={state}
                row={draft.rooms.find((r) => r.roomId === peekRoom)}
                currency={cur}
                locale={loc}
                onChange={(patch) => patchRoom(peekRoom, patch)}
                onRemove={() => dropRoom(peekRoom)}
              />
            )}
            {peekRoom && !draft.rooms.some((r) => r.roomId === peekRoom) && (
              <RoomGuestPeek
                state={state}
                roomId={peekRoom}
                checkIn={draft.checkIn || draft.eventDate}
                checkOut={draft.checkOut || addDays(draft.checkIn || draft.eventDate, 1)}
                onClose={() => setPeekRoom(null)}
                onOpen={onOpen}
              />
            )}
          </div>
          <div className="panel">
            <h3>Required documents</h3>
            <p className="muted">Hotel KYC and hall papers. Files stay on this computer until you confirm the reservation, then they are saved in the document vault.</p>
            <DocPanel
              state={state}
              types={requiredFromDraft(draft, draft.guest.nationality || "India")}
              pending={draft.pendingDocs}
              onPending={(pendingDocs) => setDraft({ ...draft, pendingDocs })}
            />
          </div>
          <div className="g2">
            <div className="panel">
              <h3>Commercials</h3>
              <div className="fields two">
                <label>Discount<input type="number" value={draft.discount} onChange={(e) => setDraft({ ...draft, discount: Number(e.target.value) || 0 })} /></label>
                <label>
                  GST
                  <select value={draft.gstMode || "with"} onChange={(e) => setDraft({ ...draft, gstMode: e.target.value })}>
                    <option value="with">With GST ({state.property.taxPercent}%)</option>
                    <option value="without">Without GST</option>
                  </select>
                </label>
                <p className="muted" style={{ gridColumn: "1 / -1", margin: 0 }}>
                  Policy advance {pol.advancePercent}% is {money(suggestedAdvance(totals.total, state.property), cur, loc)}. Security deposit {money(pol.securityDeposit, cur, loc)} is collected separately from room revenue.
                </p>

                <h4 style={{ gridColumn: "1 / -1", margin: "8px 0 0" }}>Advance payment</h4>
                <label>
                  Advance amount
                  <input type="number" min="0" value={draft.advance} onChange={(e) => setDraft({ ...draft, advance: e.target.value })} />
                </label>
                <label>
                  Advance date
                  <input type="date" value={draft.paymentDate || todayISO()} onChange={(e) => setDraft({ ...draft, paymentDate: e.target.value })} />
                </label>
                <label>
                  Advance mode
                  <select value={draft.paymentMode} onChange={(e) => setDraft({ ...draft, paymentMode: e.target.value })}>
                    {["Cash", "UPI", "Card", "Net banking", "Bank transfer", "International card"].map((m) => <option key={m}>{m}</option>)}
                  </select>
                </label>
                <label>
                  Advance ref / note
                  <input value={draft.paymentRef || ""} onChange={(e) => setDraft({ ...draft, paymentRef: e.target.value })} placeholder="UPI ref / receipt no." />
                </label>

                <h4 style={{ gridColumn: "1 / -1", margin: "12px 0 0" }}>Final payment</h4>
                <p className="muted" style={{ gridColumn: "1 / -1", margin: 0 }}>
                  Optional at booking. After confirm, the party is tracked by <strong>booking no. (BK-…)</strong> — same number for advance, final payment and report close.
                  Remaining after advance: {money(Math.max(0, totals.total - (Number(draft.advance) || 0)), cur, loc)}.
                </p>
                <label>
                  Final amount
                  <input
                    type="number"
                    min="0"
                    value={draft.finalPayment}
                    onChange={(e) => setDraft({ ...draft, finalPayment: e.target.value })}
                    placeholder={String(Math.max(0, Math.round(totals.total - (Number(draft.advance) || 0))) || "")}
                  />
                </label>
                <label>
                  Final payment date
                  <input type="date" value={draft.finalPaymentDate || todayISO()} onChange={(e) => setDraft({ ...draft, finalPaymentDate: e.target.value })} />
                </label>
                <label>
                  Final mode
                  <select value={draft.finalPaymentMode} onChange={(e) => setDraft({ ...draft, finalPaymentMode: e.target.value })}>
                    {["Cash", "UPI", "Card", "Net banking", "Bank transfer", "International card"].map((m) => <option key={m}>{m}</option>)}
                  </select>
                </label>
                <label>
                  Final ref / note
                  <input value={draft.finalPaymentRef || ""} onChange={(e) => setDraft({ ...draft, finalPaymentRef: e.target.value })} placeholder="UPI ref / receipt no." />
                </label>

                {draft.halls.length > 0 && (
                <label className="check">
                  I have read and agree to the Convention Terms & Conditions.
                  <input type="checkbox" checked={!!draft.agreeHall} onChange={(e) => setDraft({ ...draft, agreeHall: e.target.checked })} />
                </label>
                )}
                {draft.rooms.length > 0 && (
                <label className="check">
                  I have read and agree to the Room Booking Terms & Conditions.
                  <input type="checkbox" checked={!!draft.agreeRoom} onChange={(e) => setDraft({ ...draft, agreeRoom: e.target.checked })} />
                </label>
                )}
                <label style={{ gridColumn: "1 / -1" }}>Booking notes<input value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></label>
              </div>
              {error && <p style={{ color: "var(--due)" }}>{error}</p>}
              <button className="btn" type="submit" style={{ marginTop: 8 }}>Confirm reservation</button>
            </div>
            <div className="panel">
              <h3>Bill preview</h3>
              <table>
                <tbody>
                  {lines.some((l) => lineKind(l) === "function") && (
                    <tr><td colSpan={2}><strong>Hall</strong></td></tr>
                  )}
                  {lines.filter((l) => lineKind(l) === "function").map((l) => (
                    <tr key={l.id}><td>{l.description}</td><td>{money(l.amount, cur, loc)}</td></tr>
                  ))}
                  {lines.some((l) => lineKind(l) === "function") && (
                    <tr>
                      <td>Hall subtotal</td>
                      <td>{money(lines.filter((l) => lineKind(l) === "function").reduce((s, l) => s + Number(l.amount || 0), 0), cur, loc)}</td>
                    </tr>
                  )}
                  {lines.some((l) => lineKind(l) === "room") && (
                    <tr><td colSpan={2}><strong>Room stay</strong></td></tr>
                  )}
                  {lines.filter((l) => lineKind(l) === "room").map((l) => (
                    <tr key={l.id}><td>{l.description}</td><td>{money(l.amount, cur, loc)}</td></tr>
                  ))}
                  {lines.some((l) => lineKind(l) === "room") && (
                    <tr>
                      <td>Room stay subtotal</td>
                      <td>{money(lines.filter((l) => lineKind(l) === "room").reduce((s, l) => s + Number(l.amount || 0), 0), cur, loc)}</td>
                    </tr>
                  )}
                  <tr><td>Subtotal</td><td>{money(totals.subtotal, cur, loc)}</td></tr>
                  <tr><td>Discount</td><td>{money(totals.discount, cur, loc)}</td></tr>
                  {draft.gstMode === "without" ? (
                    <tr><td>GST</td><td>Without GST · {money(0, cur, loc)}</td></tr>
                  ) : (
                    <>
                      <tr><td>Taxable</td><td>{money(totals.taxable, cur, loc)}</td></tr>
                      <tr><td>CGST ({(state.property.taxPercent / 2).toFixed(1)}%)</td><td>{money(totals.cgst, cur, loc)}</td></tr>
                      <tr><td>SGST ({(state.property.taxPercent / 2).toFixed(1)}%)</td><td>{money(totals.sgst, cur, loc)}</td></tr>
                      <tr><td>{state.property.taxName} {state.property.taxPercent}%</td><td>{money(totals.tax, cur, loc)}</td></tr>
                    </>
                  )}
                  <tr><td><strong>Total</strong></td><td><strong>{money(totals.total, cur, loc)}</strong></td></tr>
                  <tr><td>Advance paid</td><td>{money(Number(draft.advance) || 0, cur, loc)}</td></tr>
                  <tr><td>Final payment</td><td>{money(Number(draft.finalPayment) || 0, cur, loc)}</td></tr>
                  <tr><td>Balance</td><td>{money(totals.balance, cur, loc)}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </form>
      </>
    );
  }

  return (
    <>
      <BookingWorkflow step={1} go={go} />
      <PageHead title="Reservations" sub="Step 1 — All bookings start here. After Confirm, use Payment & Invoice, then Guests / CRM.">
        <button className="btn" onClick={() => {
          // Always start on today's date unless staff came from Calendar with a chosen day.
          setDraft(draftFromGuest(state.property, null, presetDate || todayISO()));
          setError("");
          setMode("form");
        }}>New reservation</button>
      </PageHead>
      <div className="chips no-print" style={{ marginBottom: 10 }}>
        <button type="button" className={`chip${listTab === "active" ? " on" : ""}`} onClick={() => setListTab("active")}>
          Active ({activeRows.length})
        </button>
        <button type="button" className={`chip${listTab === "cancelled" ? " on" : ""}`} onClick={() => setListTab("cancelled")}>
          Cancelled ({cancelledRows.length})
        </button>
      </div>
      <div className="panel">
        <table>
          <thead>
            <tr><th>No.</th><th>Guest</th><th>Type</th><th>Date</th><th>Source</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {!rows.length && (
              <tr>
                <td colSpan={7} className="muted">
                  {listTab === "cancelled" ? "No cancelled bookings." : "No active bookings."}
                </td>
              </tr>
            )}
            {rows.map((b) => {
              const g = state.guests.find((x) => x.id === b.guestId);
              return (
                <tr key={b.id}>
                  <td>{b.number}</td>
                  <td>{g?.name}<div className="muted">{g?.phone}</div></td>
                  <td>{b.type}</td>
                  <td>{b.eventDate}</td>
                  <td>{originLabel(b.source)}</td>
                  <td><Pill status={b.status} /></td>
                  <td className="row">
                    <button className="btn small" onClick={() => onOpen(b.id)}>Payment</button>
                    <button className="btn ghost small" type="button" onClick={() => go?.("guests", { guestId: g?.id })}>
                      CRM
                    </button>
                    {g?.phone ? (
                      <a className="btn ghost small" href={waMe(g.phone, `${state.property.name}: regarding ${b.number}`)} target="_blank" rel="noreferrer">
                        WhatsApp
                      </a>
                    ) : null}
                    {g?.phone ? (
                      <a className="btn ghost small" href={telHref(g.phone)}>Call</a>
                    ) : null}
                    <button className="btn ghost small" onClick={() => onDocs?.(b.id)}>Documents</button>
                    {b.status !== "Cancelled" ? (
                      <button className="btn danger small" onClick={() => onCancel(b.id)}>Cancel</button>
                    ) : (
                      <button className="btn ghost small" type="button" onClick={() => go?.("reports")}>
                        Report
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function RoomStayEditor({ state, row, currency, locale, onChange, onRemove }) {
  const room = state.rooms.find((r) => r.id === row.roomId);
  const type = state.roomTypes.find((t) => t.id === room?.typeId);
  const nights = Math.max(1, nightsBetween(row.checkIn, row.checkOut) || 1);
  const extra = (Number(row.extraBed) || 0) * (type?.extraBed || 0) * nights;
  const base = (type?.baseRate || 0) * nights;
  const amount = base + extra;

  return (
    <div className="guest-peek">
      <div className="panel-head">
        <h4>Room {room?.number} · {type?.name || "Room"}</h4>
        <button type="button" className="btn danger small" onClick={onRemove}>Remove</button>
      </div>
      <p className="muted" style={{ margin: "0 0 10px" }}>
        {money(type?.baseRate || 0, currency, locale)} / night · {nights} night(s) · {money(amount, currency, locale)}
      </p>
      <div className="fields">
        <label>
          Check-in
          <input type="date" value={row.checkIn} onChange={(e) => onChange({ checkIn: e.target.value })} />
        </label>
        <label>
          Check-out
          <input type="date" value={row.checkOut} onChange={(e) => onChange({ checkOut: e.target.value })} />
        </label>
        <label>
          Extra beds
          <input type="number" min="0" value={row.extraBed} onChange={(e) => onChange({ extraBed: Number(e.target.value) || 0 })} />
        </label>
        <label>
          Children
          <input type="number" min="0" value={row.children} onChange={(e) => onChange({ children: Number(e.target.value) || 0 })} />
        </label>
      </div>
      <p className="muted" style={{ margin: "8px 0 0" }}>
        Kids are not billed extra. If a child needs a bed, add an extra bed.
      </p>
    </div>
  );
}

function RoomGuestPeek({ state, roomId, checkIn, checkOut, onClose, onOpen }) {
  const { room, stay, booking, guest, type } = roomOccupant(state, roomId, checkIn, checkOut);
  const blocked = roomSaleBlocked(room);

  if (!stay && blocked) {
    return (
      <div className="guest-peek">
        <div className="panel-head">
          <h4>Room {room?.number}</h4>
          <button type="button" className="btn ghost small" onClick={onClose}>Close</button>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          This room is {blocked}. It cannot be added to a new booking until it is Available or Inspected.
        </p>
      </div>
    );
  }

  return (
    <div className="guest-peek">
      <div className="panel-head">
        <h4>
          Room {room?.number} · {stay.status === "Occupied" ? "Occupied" : "Reserved"}
        </h4>
        <button type="button" className="btn ghost small" onClick={onClose}>Close</button>
      </div>
      {guest ? (
        <>
          <div className="fields">
            <div>
              <div className="muted">Guest</div>
              <strong>{guest.name}</strong>
            </div>
            <div>
              <div className="muted">Mobile</div>
              <strong>{guest.phone || "—"}</strong>
            </div>
            <div>
              <div className="muted">Email</div>
              {guest.email || "—"}
            </div>
            <div>
              <div className="muted">ID</div>
              {guest.idProof?.type ? `${guest.idProof.type} ${guest.idProof.number || ""}`.trim() : "—"}
            </div>
            <div>
              <div className="muted">Address</div>
              {guest.address || "—"}
            </div>
            <div>
              <div className="muted">Bill no</div>
              {booking?.number || "—"}
            </div>
            <div>
              <div className="muted">Event type</div>
              {booking?.type || "Room stay"}
            </div>
            <div>
              <div className="muted">Room type</div>
              {type?.name || "—"}
            </div>
            <div>
              <div className="muted">Check-in</div>
              {formatDateDMY(stay?.checkIn)}
            </div>
            <div>
              <div className="muted">Check-out</div>
              {formatDateDMY(stay?.checkOut)}
            </div>
            <div>
              <div className="muted">Guests</div>
              {stay ? `${stay.adults || 0} adults · ${stay.children || 0} children · ${stay.extraBed || 0} extra bed` : "—"}
            </div>
            <div>
              <div className="muted">Source</div>
              {originLabel(stay?.source || booking?.source)}
            </div>
          </div>
          <p className="muted">This room is already booked. Choose an Available or Inspected room for a new reservation.</p>
          <div className="row">
            {guest.phone ? (
              <a className="btn small" href={waMe(guest.phone, `${state.property.name}: regarding room ${room?.number}`)} target="_blank" rel="noreferrer">
                WhatsApp
              </a>
            ) : null}
            {guest.phone ? (
              <a className="btn ghost small" href={telHref(guest.phone)}>Call</a>
            ) : null}
            {booking ? (
              <button type="button" className="btn ghost small" onClick={() => onOpen?.(booking.id)}>
                Open bill
              </button>
            ) : null}
          </div>
        </>
      ) : (
        <p className="muted" style={{ margin: 0 }}>
          Room {room?.number} is marked {room?.status}, but no guest record is attached.
        </p>
      )}
    </div>
  );
}
