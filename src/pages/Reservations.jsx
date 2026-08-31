import { useMemo, useState } from "react";
import { addDays, formatDateDMY, money, nightsBetween, telHref, todayISO, waMe } from "../lib";
import { buildFolioLinesFromDraft, folioTotals, lineKind, originLabel } from "../engine";
import { requiredFromDraft } from "../docTypes";
import { PageHead, Pill } from "../ui";
import DocPanel from "./DocPanel.jsx";

const OPEN_ROOMS = new Set(["Available", "Inspected"]);
const HELD_ROOMS = new Set(["Occupied", "Reserved"]);

function activeRoomStay(state, roomId) {
  return (state.roomReservations || []).find(
    (r) => r.roomId === roomId && !["Cancelled", "Checked out"].includes(r.status)
  );
}

function roomOccupant(state, roomId) {
  const room = state.rooms.find((r) => r.id === roomId);
  const stay = activeRoomStay(state, roomId);
  const booking = state.bookings.find((b) => b.id === stay?.bookingId);
  const guest = state.guests.find((g) => g.id === stay?.guestId || g.id === booking?.guestId);
  const type = state.roomTypes.find((t) => t.id === room?.typeId);
  return { room, stay, booking, guest, type };
}

const EMPTY = {
  guest: { name: "", phone: "", email: "", address: "", nationality: "India", idProof: { type: "Aadhaar", number: "" } },
  type: "Marriage",
  source: "Direct",
  eventDate: todayISO(),
  guestsExpected: 200,
  packageId: "",
  halls: [],
  rooms: [],
  services: [],
  discount: 0,
  advance: 0,
  paymentMode: "UPI",
  notes: "",
  pendingDocs: [],
};

export default function Reservations({ state, presetDate, onSave, onCancel, onOpen, onDocs }) {
  const [mode, setMode] = useState("list");
  const [draft, setDraft] = useState({ ...EMPTY, eventDate: presetDate || todayISO() });
  const [error, setError] = useState("");
  const [peekRoom, setPeekRoom] = useState(null);
  const lines = useMemo(() => buildFolioLinesFromDraft(state, { ...draft, services: draft.services }), [state, draft]);
  const totals = folioTotals({ discount: draft.discount }, lines, [{ amount: Number(draft.advance) || 0, type: "Advance" }], state.property.taxPercent);
  const cur = state.property.currency;
  const loc = state.property.locale;

  function toggleHall(id) {
    setDraft((d) => {
      const found = d.halls.find((h) => h.hallId === id);
      const hall = state.halls.find((h) => h.id === id);
      if (found) return { ...d, halls: d.halls.filter((h) => h.hallId !== id) };
      const date = d.eventDate;
      return {
        ...d,
        halls: [
          ...d.halls,
          { hallId: id, date, slotType: "full-day", start: `${date}T06:00`, end: `${addDays(date, 1)}T06:00` },
        ],
        notes: d.notes,
      };
    });
  }

  function patchHall(id, patch) {
    setDraft((d) => ({
      ...d,
      halls: d.halls.map((h) => {
        if (h.hallId !== id) return h;
        const next = { ...h, ...patch };
        if (patch.slotType === "hourly") {
          next.end = `${next.date}T${(patch.endTime || "12:00")}`;
        } else if (patch.slotType === "half-day") {
          next.start = `${next.date}T18:00`;
          next.end = `${addDays(next.date, 1)}T00:00`;
        } else if (patch.slotType === "full-day") {
          next.start = `${next.date}T06:00`;
          next.end = `${addDays(next.date, 1)}T06:00`;
        }
        if (patch.date) {
          next.start = `${patch.date}T${(next.start || "").slice(11, 16) || "06:00"}`;
        }
        return next;
      }),
    }));
  }

  function toggleRoom(id) {
    const room = state.rooms.find((r) => r.id === id);
    if (HELD_ROOMS.has(room?.status) || activeRoomStay(state, id)) {
      setPeekRoom(id);
      return;
    }
    if (!OPEN_ROOMS.has(room?.status)) {
      setPeekRoom(id);
      return;
    }
    setDraft((d) => {
      if (d.rooms.length === 1 && d.rooms[0].roomId === id) return d;
      return {
        ...d,
        rooms: [{ roomId: id, checkIn: d.eventDate, checkOut: addDays(d.eventDate, 1), adults: 2, children: 0, extraBed: 0 }],
      };
    });
    setPeekRoom(id);
  }

  function patchRoom(id, patch) {
    setDraft((d) => ({
      ...d,
      rooms: d.rooms.map((r) => (r.roomId === id ? { ...r, ...patch } : r)),
    }));
  }

  function dropRoom(id) {
    setDraft((d) => ({ ...d, rooms: d.rooms.filter((r) => r.roomId !== id) }));
    setPeekRoom((cur) => (cur === id ? null : cur));
  }

  function submit(e) {
    e.preventDefault();
    setError("");
    if (!draft.guest.name || !draft.guest.phone) {
      setError("Guest name and phone are required.");
      return;
    }
    if (!draft.halls.length && !draft.rooms.length) {
      setError("Select at least one hall or room.");
      return;
    }
    const out = onSave({ ...draft, lines });
    if (out?.error) setError(out.error);
    else setMode("list");
  }

  const rows = [...state.bookings];

  if (mode === "form") {
    return (
      <>
        <PageHead title="New reservation" sub="Enquiry → hold → payment. Hall holds include setup and teardown so two events cannot collide.">
          <button className="btn ghost" onClick={() => { setPeekRoom(null); setMode("list"); }}>Back</button>
        </PageHead>
        <form className="form" onSubmit={submit}>
          <div className="panel">
            <h3>Guest</h3>
            <div className="fields">
              <label>Name<input value={draft.guest.name} onChange={(e) => setDraft({ ...draft, guest: { ...draft.guest, name: e.target.value } })} /></label>
              <label>Phone<input value={draft.guest.phone} onChange={(e) => setDraft({ ...draft, guest: { ...draft.guest, phone: e.target.value } })} /></label>
              <label>Event
                <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>
                  {(state.property.eventTypes || ["Marriage", "Reception", "Engagement", "Birthday", "Corporate"]).concat(["Room only", "Other"]).filter((t, i, a) => a.indexOf(t) === i).map((t) => <option key={t}>{t}</option>)}
                </select>
              </label>
              <label>Source
                <select value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })}>
                  {["Direct", "Walk-in", "Website", "Corporate", "Group", "Online"].map((t) => <option key={t}>{t}</option>)}
                </select>
              </label>
              <label>Event date<input type="date" value={draft.eventDate} onChange={(e) => setDraft({ ...draft, eventDate: e.target.value })} /></label>
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
            <h3>Function · halls</h3>
            <p className="muted">Marriage, reception and other event halls. Hourly, half-day or full-day.</p>
            <div className="chips">
              {state.halls.filter((h) => h.active !== false).map((h) => (
                <button type="button" key={h.id} className={`chip ${draft.halls.some((x) => x.hallId === h.id) ? "on" : ""}`} onClick={() => toggleHall(h.id)}>
                  {h.name} · {money(h.rates.fullDay, cur, loc)}
                </button>
              ))}
            </div>
            {draft.halls.map((h) => {
              const hall = state.halls.find((x) => x.id === h.hallId);
              return (
                <div className="fields" key={h.hallId} style={{ marginTop: 10 }}>
                  <label>{hall.name} date<input type="date" value={h.date} onChange={(e) => patchHall(h.hallId, { date: e.target.value })} /></label>
                  <label>Slot
                    <select value={h.slotType} onChange={(e) => patchHall(h.hallId, { slotType: e.target.value })}>
                      <option value="hourly">Hourly</option>
                      <option value="half-day">Half day</option>
                      <option value="full-day">Full day 24h</option>
                    </select>
                  </label>
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
            <p className="muted">Click a room to see it. The previous room is cleared. Occupied or Reserved shows the guest.</p>
            <div className="chips">
              {state.rooms.map((r) => {
                const held = HELD_ROOMS.has(r.status) || activeRoomStay(state, r.id);
                const selected = draft.rooms.some((x) => x.roomId === r.id);
                return (
                  <button
                    type="button"
                    key={r.id}
                    className={`chip${selected ? " on" : ""}${held ? " held" : ""}${peekRoom === r.id ? " peek" : ""}`}
                    onClick={() => toggleRoom(r.id)}
                  >
                    {r.number} {r.status}
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
              <RoomGuestPeek state={state} roomId={peekRoom} onClose={() => setPeekRoom(null)} onOpen={onOpen} />
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
                <label>Advance<input type="number" value={draft.advance} onChange={(e) => setDraft({ ...draft, advance: e.target.value })} /></label>
                <label>Mode
                  <select value={draft.paymentMode} onChange={(e) => setDraft({ ...draft, paymentMode: e.target.value })}>
                    {["Cash", "UPI", "Card", "Net banking", "Bank transfer", "International card"].map((m) => <option key={m}>{m}</option>)}
                  </select>
                </label>
                <label>Notes<input value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></label>
              </div>
              {error && <p style={{ color: "var(--due)" }}>{error}</p>}
              <button className="btn" type="submit" style={{ marginTop: 8 }}>Confirm reservation</button>
            </div>
            <div className="panel">
              <h3>Bill preview</h3>
              <table>
                <tbody>
                  {lines.some((l) => lineKind(l) === "function") && (
                    <tr><td colSpan={2}><strong>Function</strong></td></tr>
                  )}
                  {lines.filter((l) => lineKind(l) === "function").map((l) => (
                    <tr key={l.id}><td>{l.description}</td><td>{money(l.amount, cur, loc)}</td></tr>
                  ))}
                  {lines.some((l) => lineKind(l) === "function") && (
                    <tr>
                      <td>Function subtotal</td>
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
                  <tr><td>{state.property.taxName} {state.property.taxPercent}%</td><td>{money(totals.tax, cur, loc)}</td></tr>
                  <tr><td><strong>Total</strong></td><td><strong>{money(totals.total, cur, loc)}</strong></td></tr>
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
      <PageHead title="Reservations" sub="Pipeline: enquiry → quotation → confirmation. Cancel releases halls and rooms and can post a refund.">
        <button className="btn" onClick={() => { setDraft({ ...EMPTY, eventDate: presetDate || todayISO() }); setMode("form"); }}>New reservation</button>
      </PageHead>
      <div className="panel">
        <table>
          <thead>
            <tr><th>No.</th><th>Guest</th><th>Type</th><th>Date</th><th>Source</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
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
                    {g?.phone ? (
                      <a className="btn ghost small" href={waMe(g.phone, `Gayatri Function Hall: regarding ${b.number}`)} target="_blank" rel="noreferrer">
                        WhatsApp
                      </a>
                    ) : null}
                    {g?.phone ? (
                      <a className="btn ghost small" href={telHref(g.phone)}>Call</a>
                    ) : null}
                    <button className="btn ghost small" onClick={() => onDocs?.(b.id)}>Documents</button>
                    {b.status !== "Cancelled" && (
                      <button className="btn danger small" onClick={() => onCancel(b.id)}>Cancel</button>
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
        <h4>Room {room?.number} · {type?.name || "Room"} · Floor {room?.floor}</h4>
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

function RoomGuestPeek({ state, roomId, onClose, onOpen }) {
  const { room, stay, booking, guest, type } = roomOccupant(state, roomId);
  const held = HELD_ROOMS.has(room?.status);

  if (!held && !stay) {
    return (
      <div className="guest-peek">
        <div className="panel-head">
          <h4>Room {room?.number}</h4>
          <button type="button" className="btn ghost small" onClick={onClose}>Close</button>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          This room is {room?.status}. It cannot be added to a new booking until it is Available or Inspected.
        </p>
      </div>
    );
  }

  return (
    <div className="guest-peek">
      <div className="panel-head">
        <h4>
          Room {room?.number} · {room?.status}
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
              <div className="muted">Occasion</div>
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
              <a className="btn small" href={waMe(guest.phone, `Gayatri Function Hall: regarding room ${room?.number}`)} target="_blank" rel="noreferrer">
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
