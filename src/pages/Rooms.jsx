import { useRef, useState } from "react";
import { money, totalPhysicalRooms, typeListedRoomsCell, typeRoomMix } from "../lib";
import { housekeepingOf, occupancyOf } from "../policies";
import { PageHead, Pill } from "../ui";

const OCC = ["Available", "Reserved", "Occupied", "Out of order", "Maintenance"];
const HK = ["Clean", "Dirty", "Cleaning", "Inspected"];

const emptyType = { name: "", baseRate: 0, extraBed: 0, childRate: 0, maxGuests: 4, extraBeds: 2, composition: "" };
const emptyRoom = { number: "", floor: 1, typeId: "", status: "Available" };

function guestsText(t) {
  const extra = Number(t.extraBeds) || 0;
  return extra ? `2+${extra}` : String(t.maxGuests || 2);
}

function roomFloor(room) {
  return Number(room?.floor) || 1;
}

function roomsByFloor(rooms) {
  const floors = [...new Set(rooms.map((r) => roomFloor(r)))].sort((a, b) => a - b);
  return floors.map((floor) => ({
    floor,
    rooms: rooms
      .filter((r) => roomFloor(r) === floor)
      .sort((a, b) => String(a.number).localeCompare(String(b.number), undefined, { numeric: true })),
  }));
}

function occClass(status) {
  return `occ-${String(status || "Available").replace(/\s+/g, "-")}`;
}

export default function Rooms({
  state,
  onRoomType,
  onRoom,
  onRemoveRoom,
  onStatus,
  onHousekeeping,
  onCheckIn,
  onCheckOut,
  onTransfer,
}) {
  const [rtype, setRtype] = useState(null);
  const [room, setRoom] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [note, setNote] = useState("");
  const detailRef = useRef(null);
  const cur = state.property.currency;
  const loc = state.property.locale;
  const m = (n) => money(n, cur, loc);
  const typeName = (id) => state.roomTypes.find((t) => t.id === id)?.name;
  const stay = (roomId) =>
    state.roomReservations.find((r) => r.roomId === roomId && !["Cancelled", "Checked out"].includes(r.status));

  function ping(msg) {
    setNote(msg);
    window.setTimeout(() => setNote(""), 2800);
  }

  function focusRoom(id) {
    setSelectedId(id);
    setRtype(null);
    if (!room || room.id !== id) setRoom(null);
    window.requestAnimationFrame(() => {
      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  const selected = state.rooms.find((r) => r.id === selectedId);
  const selectedStay = selected ? stay(selected.id) : null;
  const selectedGuest = selectedStay ? state.guests.find((g) => g.id === selectedStay.guestId) : null;
  const selectedType = selected ? state.roomTypes.find((t) => t.id === selected.typeId) : null;
  const editingSelected = room && selected && room.id === selected.id;
  const floorGroups = roomsByFloor(state.rooms);

  return (
    <>
      <PageHead title="Rooms" sub="Floor plan, occupancy and housekeeping." />
      {note && <p className="pill ok" style={{ marginBottom: 10 }}>{note}</p>}

      <div className="panel rooms-board-panel">
        <div className="panel-head">
          <div>
            <h3>Room board</h3>
            <p className="muted" style={{ margin: "4px 0 0" }}>Rooms grouped by floor. Click a room for details.</p>
          </div>
        </div>
        <div className="room-board-layout">
          <div className="room-board-main">
            <div className="kpis room-board-kpis">
              {OCC.slice(0, 4).map((s) => (
                <div className="kpi" key={s}>
                  <div className="k">{s}</div>
                  <div className="v">{state.rooms.filter((r) => occupancyOf(r) === s).length}</div>
                </div>
              ))}
            </div>
            <div className="room-floors">
              {floorGroups.map(({ floor, rooms }) => {
                const floorType = typeName(rooms[0]?.typeId);
                return (
                  <section key={floor} className="room-floor">
                    <div className="room-floor-head">
                      <strong>Floor {floor}</strong>
                      <span>{floorType || "Rooms"} · {rooms.length} room{rooms.length === 1 ? "" : "s"}</span>
                    </div>
                    <div className="room-floor-row">
                      {rooms.map((row) => {
                        const res = stay(row.id);
                        const guest = state.guests.find((g) => g.id === res?.guestId);
                        const occ = occupancyOf(row);
                        const hk = housekeepingOf(row);
                        return (
                          <button
                            key={row.id}
                            type="button"
                            className={`room-tile ${occClass(occ)}${selectedId === row.id ? " is-selected" : ""}`}
                            onClick={() => focusRoom(row.id)}
                          >
                            <span className="room-tile-no">{row.number}</span>
                            <span className="room-tile-type">{typeName(row.typeId)}</span>
                            <span className="room-tile-badges">
                              <Pill status={occ} />
                              <Pill status={hk === "Clean" || hk === "Inspected" ? "Paid" : "Due"}>{hk}</Pill>
                            </span>
                            <span className="room-tile-guest">{guest ? guest.name : "Vacant"}</span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>

          {selected ? (
            <div className="room-detail-panel" ref={detailRef}>
              <div className="room-detail-head">
                <div>
                  <h4>Room {selected.number}</h4>
                  <p className="muted">
                    {selectedType?.name || "—"} · Floor {selected.floor || "—"} · {m(selectedType?.baseRate)}
                  </p>
                </div>
                <button type="button" className="btn ghost small" onClick={() => { setSelectedId(null); setRoom(null); }}>
                  Close
                </button>
              </div>

              {!editingSelected && (
                <>
                  <div className="room-detail-grid">
                    <div>
                      <span className="room-detail-label">Occupancy</span>
                      <Pill status={occupancyOf(selected)} />
                    </div>
                    <div>
                      <span className="room-detail-label">Housekeeping</span>
                      <Pill status={housekeepingOf(selected) === "Clean" || housekeepingOf(selected) === "Inspected" ? "Paid" : "Due"}>
                        {housekeepingOf(selected)}
                      </Pill>
                    </div>
                    <div>
                      <span className="room-detail-label">Base rate</span>
                      <strong>{m(selectedType?.baseRate)}</strong>
                    </div>
                    <div>
                      <span className="room-detail-label">Extra bed</span>
                      <strong>{selectedType?.extraBed ? m(selectedType.extraBed) : "—"}</strong>
                    </div>
                  </div>

                  <div className="room-detail-guest">
                    <span className="room-detail-label">Guest stay</span>
                    {selectedGuest && selectedStay ? (
                      <>
                        <strong>{selectedGuest.name}</strong>
                        <p className="muted">{selectedStay.checkIn} → {selectedStay.checkOut}</p>
                        <p className="muted">{selectedStay.source || "Direct"} · {selectedStay.status}</p>
                      </>
                    ) : (
                      <p className="muted">No in-house guest</p>
                    )}
                  </div>

                  <div className="row" style={{ marginTop: 10 }}>
                    {selectedStay?.status === "Reserved" && (
                      <button type="button" className="btn small" onClick={() => onCheckIn(selectedStay.id)}>Check in</button>
                    )}
                    {selectedStay?.status === "Occupied" && (
                      <button type="button" className="btn ghost small" onClick={() => onCheckOut(selectedStay.id)}>Check out</button>
                    )}
                    {selectedStay && (
                      <button
                        type="button"
                        className="btn ghost small"
                        onClick={() => {
                          const n = window.prompt("Transfer to room number", "");
                          const target = state.rooms.find((x) => x.number === n);
                          if (target) {
                            const out = onTransfer(selectedStay.id, target.id);
                            if (out?.error) window.alert(out.error);
                            else if (target.id !== selected.id) focusRoom(target.id);
                          }
                        }}
                      >
                        Transfer
                      </button>
                    )}
                    <button type="button" className="btn ghost small" onClick={() => setRoom({ ...selected })}>Edit room</button>
                    <button
                      type="button"
                      className="btn danger small"
                      onClick={() => {
                        if (!window.confirm(`Delete room ${selected.number}?`)) return;
                        const out = onRemoveRoom?.(selected.id);
                        if (out?.error) window.alert(out.error);
                        else {
                          ping(`Room ${selected.number} deleted.`);
                          setSelectedId(null);
                          setRoom(null);
                        }
                      }}
                    >
                      Delete
                    </button>
                  </div>

                  <div className="fields two" style={{ marginTop: 10 }}>
                    <label>
                      Occupancy
                      <select value={occupancyOf(selected)} onChange={(e) => onStatus(selected.id, e.target.value)}>
                        {OCC.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Housekeeping
                      <select value={housekeepingOf(selected)} onChange={(e) => onHousekeeping(selected.id, e.target.value)}>
                        {HK.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                </>
              )}

              {editingSelected && (
                <div style={{ marginTop: 4 }}>
                  <h4 style={{ margin: "0 0 8px" }}>Edit room {room.number}</h4>
                  <div className="fields two">
                    <label>Number<input value={room.number} onChange={(e) => setRoom({ ...room, number: e.target.value })} /></label>
                    <label>
                      Type
                      <select value={room.typeId} onChange={(e) => setRoom({ ...room, typeId: e.target.value })}>
                        {state.roomTypes.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Status
                      <select value={room.status} onChange={(e) => setRoom({ ...room, status: e.target.value })}>
                        {OCC.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </label>
                    <label>Floor<input type="number" min="1" value={room.floor ?? 1} onChange={(e) => setRoom({ ...room, floor: e.target.value })} /></label>
                  </div>
                  <div className="row" style={{ marginTop: 8 }}>
                    <button
                      type="button"
                      className="btn small"
                      onClick={() => {
                        const out = onRoom(room);
                        if (out?.error) window.alert(out.error);
                        else {
                          ping("Room saved.");
                          setRoom(null);
                        }
                      }}
                    >
                      Save room
                    </button>
                    <button type="button" className="btn ghost small" onClick={() => setRoom(null)}>Cancel edit</button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="room-detail-panel room-detail-empty" ref={detailRef}>
              <p className="room-detail-label">Room details</p>
              <p className="muted">Select a room on the floor plan to see guest stay, rates and actions.</p>
            </div>
          )}
        </div>
      </div>

      <div className="panel" style={{ marginTop: 12 }}>
        <div className="panel-head">
          <h3>Room types</h3>
          <button type="button" className="btn small" onClick={() => setRtype({ ...emptyType })}>
            + Type
          </button>
        </div>
        <div className="table-wrap">
          <table className="tariff">
            <colgroup>
              <col style={{ width: "32%" }} />
              <col style={{ width: "18%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "14%" }} />
            </colgroup>
            <thead>
              <tr>
                <th>Type</th>
                <th className="num">Base rate</th>
                <th className="num">Extra bed</th>
                <th className="num">Max guests</th>
                <th className="num">No. of rooms</th>
              </tr>
            </thead>
            <tbody>
              {state.roomTypes.map((t) => {
                const mix = typeRoomMix(t);
                return (
                <tr key={t.id} className="clickable" onClick={() => setRtype({ ...t })}>
                  <td>{mix ? `${t.name} (${mix})` : t.name}</td>
                  <td className="num">{m(t.baseRate)}</td>
                  <td className="num">{t.extraBed ? m(t.extraBed) : "—"}</td>
                  <td className="num">{guestsText(t)}</td>
                  <td className="num">{typeListedRoomsCell(t, state.rooms)}</td>
                </tr>
              );})}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4}><strong>Total rooms</strong></td>
                <td className="num"><strong>{totalPhysicalRooms(state.rooms)}</strong></td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="muted" style={{ marginTop: 10 }}>{totalPhysicalRooms(state.rooms)} rooms in all</p>
        {rtype && (
          <div style={{ marginTop: 12 }}>
            <h4 style={{ margin: "0 0 8px" }}>{rtype.id ? "Edit type" : "New type"}</h4>
            <div className="fields two">
              <label>Type<input value={rtype.name} onChange={(e) => setRtype({ ...rtype, name: e.target.value })} /></label>
              <label>Composition<input value={rtype.composition || ""} onChange={(e) => setRtype({ ...rtype, composition: e.target.value })} placeholder="e.g. 4 Deluxe AC (packages only)" /></label>
              <label>Base rate<input type="number" value={rtype.baseRate} onChange={(e) => setRtype({ ...rtype, baseRate: e.target.value })} /></label>
              <label>Extra bed<input type="number" value={rtype.extraBed} onChange={(e) => setRtype({ ...rtype, extraBed: e.target.value })} /></label>
              <label>
                Extra beds (2+…)
                <input
                  type="number"
                  min="0"
                  value={rtype.extraBeds ?? 0}
                  onChange={(e) => {
                    const extraBeds = e.target.value;
                    const extra = Number(extraBeds) || 0;
                    setRtype({ ...rtype, extraBeds, maxGuests: extra ? 2 + extra : rtype.maxGuests });
                  }}
                />
              </label>
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              <button
                type="button"
                className="btn small"
                onClick={() => {
                  const extraBeds = Number(rtype.extraBeds) || 0;
                  const out = onRoomType({
                    ...rtype,
                    extraBeds,
                    maxGuests: extraBeds ? 2 + extraBeds : Number(rtype.maxGuests) || 2,
                  });
                  if (out?.error) window.alert(out.error);
                  else {
                    ping("Room type saved.");
                    setRtype(null);
                  }
                }}
              >
                Save type
              </button>
              <button type="button" className="btn ghost small" onClick={() => setRtype(null)}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      <div className="panel" style={{ marginTop: 12 }}>
        <div className="panel-head">
          <h3>Rooms</h3>
          <button
            type="button"
            className="btn small"
            onClick={() => {
              setSelectedId(null);
              setRtype(null);
              setRoom({ ...emptyRoom, typeId: state.roomTypes[0]?.id || "" });
            }}
          >
            + Room
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>No.</th><th>Floor</th><th>Type</th><th>Status</th></tr>
            </thead>
            <tbody>
              {state.rooms.map((r) => (
                <tr
                  key={r.id}
                  className={`clickable${selectedId === r.id ? " is-selected" : ""}`}
                  onClick={() => focusRoom(r.id)}
                >
                  <td>{r.number}</td>
                  <td>{roomFloor(r)}</td>
                  <td>{typeName(r.typeId)}</td>
                  <td>{occupancyOf(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {room && !selectedId && (
          <div style={{ marginTop: 12 }}>
            <h4 style={{ margin: "0 0 8px" }}>New room</h4>
            <div className="fields two">
              <label>Number<input value={room.number} onChange={(e) => setRoom({ ...room, number: e.target.value })} /></label>
              <label>Floor<input type="number" min="1" value={room.floor ?? 1} onChange={(e) => setRoom({ ...room, floor: e.target.value })} /></label>
              <label>
                Type
                <select value={room.typeId} onChange={(e) => setRoom({ ...room, typeId: e.target.value })}>
                  {state.roomTypes.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Status
                <select value={room.status} onChange={(e) => setRoom({ ...room, status: e.target.value })}>
                  {OCC.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              <button
                type="button"
                className="btn small"
                onClick={() => {
                  const out = onRoom(room);
                  if (out?.error) window.alert(out.error);
                  else {
                    ping("Room saved.");
                    setRoom(null);
                  }
                }}
              >
                Save room
              </button>
              <button type="button" className="btn ghost small" onClick={() => setRoom(null)}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
