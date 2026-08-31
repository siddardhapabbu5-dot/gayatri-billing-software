import { money } from "../lib";
import { PageHead, Pill } from "../ui";

const CYCLE = ["Available", "Reserved", "Occupied", "Dirty", "Cleaning", "Inspected", "Maintenance", "Out of order"];

export default function Rooms({ state, onStatus, onCheckIn, onCheckOut, onTransfer }) {
  const typeName = (id) => state.roomTypes.find((t) => t.id === id)?.name;
  const rate = (id) => state.roomTypes.find((t) => t.id === id)?.baseRate;
  const stay = (roomId) =>
    state.roomReservations.find((r) => r.roomId === roomId && !["Cancelled", "Checked out"].includes(r.status));

  return (
    <>
      <PageHead title="Room rack" sub="PMS statuses: Available, Reserved, Occupied, Dirty, Cleaning, Inspected, Maintenance, Out of order. Check-out sends the room to Dirty." />
      <div className="kpis">
        {CYCLE.slice(0, 4).map((s) => (
          <div className="kpi" key={s}>
            <div className="k">{s}</div>
            <div className="v">{state.rooms.filter((r) => r.status === s).length}</div>
          </div>
        ))}
      </div>
      <div className="room-grid">
        {state.rooms.map((room) => {
          const res = stay(room.id);
          const guest = state.guests.find((g) => g.id === res?.guestId);
          return (
            <div key={room.id} className="room-card">
              <div className="no">{room.number}</div>
              <div className="meta">Floor {room.floor} · {typeName(room.typeId)} · {money(rate(room.typeId), state.property.currency, state.property.locale)}</div>
              <Pill status={room.status} />
              <div className="guest">
                {guest ? (
                  <>
                    <strong>{guest.name}</strong>
                    <div className="muted">{res.checkIn} → {res.checkOut} · {res.source}</div>
                  </>
                ) : (
                  <span className="muted">No in-house guest</span>
                )}
                <div className="row" style={{ marginTop: 8 }}>
                  {res?.status === "Reserved" && (
                    <button className="btn small" onClick={() => onCheckIn(res.id)}>Check in</button>
                  )}
                  {res?.status === "Occupied" && (
                    <button className="btn ghost small" onClick={() => onCheckOut(res.id)}>Check out</button>
                  )}
                  {res && (
                    <button
                      className="btn ghost small"
                      onClick={() => {
                        const n = window.prompt("Transfer to room number", "");
                        const target = state.rooms.find((r) => r.number === n);
                        if (target) {
                          const out = onTransfer(res.id, target.id);
                          if (out?.error) window.alert(out.error);
                        }
                      }}
                    >
                      Transfer
                    </button>
                  )}
                  <select
                    value={room.status}
                    onChange={(e) => onStatus(room.id, e.target.value)}
                    style={{ fontSize: 11, padding: 4 }}
                  >
                    {CYCLE.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="panel" style={{ marginTop: 12 }}>
        <h3>Room types</h3>
        <table>
          <thead>
            <tr><th>Type</th><th>Rack</th><th>Extra bed</th><th>Max</th></tr>
          </thead>
          <tbody>
            {state.roomTypes.map((t) => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td>{money(t.baseRate, state.property.currency, state.property.locale)}</td>
                <td>{money(t.extraBed, state.property.currency, state.property.locale)}</td>
                <td>{t.maxGuests}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
