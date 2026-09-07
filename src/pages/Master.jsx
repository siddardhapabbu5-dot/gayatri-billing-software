import { useState, useRef } from "react";
import { flushSync } from "react-dom";
import { capacityText, formatDateDMY, gstinText, money, todayISO, totalPhysicalRooms, typeListedRoomsCell, typeRoomMix } from "../lib";
import { TERM_LANGS, TERM_SECTIONS, cancelSectionLines, policiesOf, roomCheckInOutText, sectionLines, termSetsOf } from "../policies";
import { getState } from "../store";
import { PageHead } from "../ui";

const TABS = [
  ["property", "Property & website"],
  ["halls", "Halls"],
  ["rooms", "Rooms"],
];

const emptyHall = {
  name: "",
  code: "",
  kind: "Indoor",
  tag: "",
  jp: "",
  copy: "",
  capacity: 200,
  capacityMin: 0,
  floating: 250,
  dining: 150,
  parking: 40,
  setupHours: 2,
  teardownHours: 1,
  bufferMinutes: 30,
  minValue: 0,
  rates: { halfDay: 0, fullDay: 0 },
  seating: "Banquet",
  webPhoto: "",
  photo: "",
  active: true,
};

const emptyRoom = { number: "", floor: 1, typeId: "", status: "Available" };
const emptyType = { name: "", baseRate: 0, extraBed: 0, childRate: 0, maxGuests: 4, extraBeds: 2, composition: "" };

function guestsText(t) {
  const extra = Number(t.extraBeds) || 0;
  return extra ? `2+${extra}` : String(t.maxGuests || 2);
}

export default function Master({ state, onProperty, onHall, onRoomType, onRoom, onRemoveRoom, onRefresh }) {
  const [tab, setTab] = useState("property");
  const [note, setNote] = useState("");
  const [saveFlash, setSaveFlash] = useState(null);
  const saveAnchorRef = useRef(null);
  const p = state.property;
  const [prop, setProp] = useState(() => ({
    name: p.name || "",
    brandName: p.brandName || "",
    tagline: p.tagline || "",
    place: p.place || "",
    address: (p.address || []).join("\n"),
    phone: p.phone || "",
    notifyPhone: p.notifyPhone || p.phone || "",
    email: p.email || "",
    desk: p.desk || "",
    gstin: p.gstin || "",
    taxName: p.taxName || "GST",
    taxPercent: p.taxPercent || 0,
    currency: p.currency || "INR",
    about: p.about || "",
    banquetIntro: p.banquetIntro || "",
    mapQuery: p.mapQuery || "",
    eventTypes: (p.eventTypes || []).join("\n"),
    stories: (p.stories || []).map((s) => `${s.cite || ""}\n${s.quote || ""}`).join("\n---\n"),
  }));
  const [hall, setHall] = useState(null);
  const [room, setRoom] = useState(null);
  const [rtype, setRtype] = useState(null);
  const [printData, setPrintData] = useState(null);
  const cur = p.currency;
  const loc = p.locale;
  const m = (n) => money(n, cur, loc);
  const sheet = printData || state;
  const sheetP = sheet.property;
  const sheetCur = sheetP.currency;
  const sheetLoc = sheetP.locale;
  const sheetM = (n) => money(n, sheetCur, sheetLoc);
  const sheetPol = policiesOf(sheetP);
  const sheetTerms = termSetsOf(sheetP);

  function printMaster() {
    const latest = getState();
    flushSync(() => {
      setPrintData(latest);
      onRefresh?.();
    });
    const liveP = latest.property;
    const prev = document.title;
    document.title = `${(liveP.name || "Gayatri").replace(/\s+/g, "-")}-master-data-${todayISO()}`;
    window.print();
    window.setTimeout(() => {
      document.title = prev;
      setPrintData(null);
    }, 800);
  }

  function flashSave(msg) {
    setSaveFlash(msg);
    window.setTimeout(() => {
      saveAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 40);
    window.setTimeout(() => setSaveFlash(null), 6000);
  }

  function ping(msg) {
    setNote(msg);
    window.setTimeout(() => setNote(""), 2800);
  }

  function saveProperty() {
    const orderedTypes = String(prop.eventTypes || "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const stories = String(prop.stories || "")
      .split(/\n---\n/)
      .map((block) => {
        const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
        if (!lines.length) return null;
        return { cite: lines[0], quote: lines.slice(1).join(" ") || lines[0] };
      })
      .filter(Boolean);
    onProperty({
      name: prop.name,
      brandName: prop.brandName,
      tagline: prop.tagline,
      place: prop.place,
      address: String(prop.address || "").split("\n").map((l) => l.trim()).filter(Boolean),
      phone: prop.phone,
      notifyPhone: prop.notifyPhone,
      email: prop.email,
      desk: prop.desk,
      gstin: String(prop.gstin || "").trim().toUpperCase(),
      taxName: prop.taxName,
      taxPercent: Number(prop.taxPercent) || 0,
      currency: String(prop.currency || "INR").toUpperCase(),
      about: prop.about,
      banquetIntro: prop.banquetIntro,
      mapQuery: prop.mapQuery,
      mapLat: Number(String(prop.mapQuery || "").split(",")[0]) || p.mapLat,
      mapLng: Number(String(prop.mapQuery || "").split(",")[1]) || p.mapLng,
      eventTypes: orderedTypes,
      stories,
    });
    const saved = getState().property;
    setProp((prev) => ({
      ...prev,
      eventTypes: (saved.eventTypes || orderedTypes).join("\n"),
    }));
    flashSave("Property and website updated. Event types are saved in your order for the Book form and Master PDF.");
  }

  function pickHall(h) {
    setHall({
      ...emptyHall,
      ...h,
      seating: (h.seating || []).join(", "),
      rates: { halfDay: h.rates?.halfDay || 0, fullDay: h.rates?.fullDay || 0 },
    });
  }

  return (
    <>
      <div className="no-print">
      <PageHead title="Master data" sub="Change halls, rooms and website text here. It updates the staff software and the public site.">
        <button className="btn" type="button" onClick={printMaster}>
          Print / PDF
        </button>
      </PageHead>
      {saveFlash && (
        <div className="master-save-flash" role="status" aria-live="polite">
          <strong>Updated successfully</strong>
          <span>{saveFlash}</span>
        </div>
      )}
      {note && <p className="pill ok" style={{ marginBottom: 10 }}>{note}</p>}
      <div className="chips" style={{ marginBottom: 12 }}>
        {TABS.map(([id, label]) => (
          <button key={id} type="button" className={`chip${tab === id ? " on" : ""}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === "property" && (
        <div className="panel">
          <h3>Property & website</h3>
          <div className="fields two">
            <label>Hall / company name<input value={prop.name} onChange={(e) => setProp({ ...prop, name: e.target.value })} /></label>
            <label>Short name on website<input value={prop.brandName} onChange={(e) => setProp({ ...prop, brandName: e.target.value })} /></label>
            <label>Tagline<input value={prop.tagline} onChange={(e) => setProp({ ...prop, tagline: e.target.value })} /></label>
            <label>Place line<input value={prop.place} onChange={(e) => setProp({ ...prop, place: e.target.value })} /></label>
            <label>Phone<input value={prop.phone} onChange={(e) => setProp({ ...prop, phone: e.target.value })} /></label>
            <label>WhatsApp desk<input value={prop.notifyPhone} onChange={(e) => setProp({ ...prop, notifyPhone: e.target.value })} /></label>
            <label>Email<input value={prop.email} onChange={(e) => setProp({ ...prop, email: e.target.value })} /></label>
            <label>Desk hours<input value={prop.desk} onChange={(e) => setProp({ ...prop, desk: e.target.value })} /></label>
            <label>Gayatri GSTIN<input value={prop.gstin} onChange={(e) => setProp({ ...prop, gstin: e.target.value })} /></label>
            <label>Tax name<input value={prop.taxName} onChange={(e) => setProp({ ...prop, taxName: e.target.value })} /></label>
            <label>Tax %<input type="number" value={prop.taxPercent} onChange={(e) => setProp({ ...prop, taxPercent: e.target.value })} /></label>
            <label>Currency<input value={prop.currency} onChange={(e) => setProp({ ...prop, currency: e.target.value })} /></label>
          </div>
          <label style={{ marginTop: 10 }}>
            Address (one line per row)
            <textarea value={prop.address} onChange={(e) => setProp({ ...prop, address: e.target.value })} />
          </label>
          <label>
            About text (website)
            <textarea value={prop.about} onChange={(e) => setProp({ ...prop, about: e.target.value })} />
          </label>
          <p className="muted" style={{ margin: "12px 0" }}>
            Terms & Conditions, advance %, and check-in/out times are in <strong>Settings → Terms & Conditions</strong> and <strong>Booking policies</strong>. Do not keep a second copy here.
          </p>
          <label>
            Google Maps place
            <input value={prop.mapQuery} onChange={(e) => setProp({ ...prop, mapQuery: e.target.value })} />
          </label>
          <p className="muted" style={{ margin: "6px 0 12px" }}>
            Visit page map searches this place. Use the Google listing name (Gayatri Water and Beverages, Palagummi), not only “Gayatri Function Hall”.
          </p>
          <label>
            Event types (website Book form — one per line)
            <textarea value={prop.eventTypes} onChange={(e) => setProp({ ...prop, eventTypes: e.target.value })} />
          </label>
          <label>
            Guest stories (optional — not on the website yet. Add real reviews later when guests write to you.)
            <textarea value={prop.stories} onChange={(e) => setProp({ ...prop, stories: e.target.value })} style={{ minHeight: 140 }} />
          </label>
          <button
            ref={saveAnchorRef}
            className="btn"
            type="button"
            style={{ marginTop: 10 }}
            onClick={saveProperty}
          >
            Save property & website
          </button>
        </div>
      )}

      {tab === "halls" && (
        <div className="g2">
          <div className="panel">
            <div className="panel-head">
              <h3>Halls</h3>
              <button type="button" className="btn small" onClick={() => setHall({ ...emptyHall })}>
                + Hall
              </button>
            </div>
            <table>
              <thead>
                <tr><th>Name</th><th>Capacity</th><th>Half day</th><th>Full day</th><th>Status</th></tr>
              </thead>
              <tbody>
                {state.halls.map((h) => (
                  <tr key={h.id} className="clickable" onClick={() => pickHall(h)}>
                    <td>
                      {h.name}
                      <div className="muted">{h.code} · {h.kind} · {(h.seating || []).join(", ")}</div>
                    </td>
                    <td>{capacityText(h)}</td>
                    <td>{m(h.rates?.halfDay)}</td>
                    <td>{m(h.rates?.fullDay)}</td>
                    <td>{h.active === false ? "Off" : "On"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hall && (
            <div className="panel">
              <h3>{hall.id ? "Edit hall" : "New hall"}</h3>
              <div className="fields two">
                <label>Name<input value={hall.name} onChange={(e) => setHall({ ...hall, name: e.target.value })} /></label>
                <label>Code<input value={hall.code} onChange={(e) => setHall({ ...hall, code: e.target.value })} /></label>
                <label>Kind<input value={hall.kind} onChange={(e) => setHall({ ...hall, kind: e.target.value })} /></label>
                <label>Short line (website)<input value={hall.jp} onChange={(e) => setHall({ ...hall, jp: e.target.value })} /></label>
                <label>Capacity from<input type="number" value={hall.capacityMin || ""} onChange={(e) => setHall({ ...hall, capacityMin: e.target.value })} /></label>
                <label>Capacity to<input type="number" value={hall.capacity} onChange={(e) => setHall({ ...hall, capacity: e.target.value })} /></label>
                <label>Floating<input type="number" value={hall.floating} onChange={(e) => setHall({ ...hall, floating: e.target.value })} /></label>
                <label>Dining<input type="number" value={hall.dining} onChange={(e) => setHall({ ...hall, dining: e.target.value })} /></label>
                <label>Parking<input type="number" value={hall.parking} onChange={(e) => setHall({ ...hall, parking: e.target.value })} /></label>
                <label>Half-day rate<input type="number" value={hall.rates.halfDay} onChange={(e) => setHall({ ...hall, rates: { ...hall.rates, halfDay: e.target.value } })} /></label>
                <label>Full-day rate<input type="number" value={hall.rates.fullDay} onChange={(e) => setHall({ ...hall, rates: { ...hall.rates, fullDay: e.target.value } })} /></label>
                <label>Minimum<input type="number" value={hall.minValue} onChange={(e) => setHall({ ...hall, minValue: e.target.value })} /></label>
                <label>Setup hours<input type="number" value={hall.setupHours} onChange={(e) => setHall({ ...hall, setupHours: e.target.value })} /></label>
                <label>Teardown hours<input type="number" value={hall.teardownHours} onChange={(e) => setHall({ ...hall, teardownHours: e.target.value })} /></label>
              </div>
              <label>Website description<textarea value={hall.copy} onChange={(e) => setHall({ ...hall, copy: e.target.value })} /></label>
              <label>Staff note / tag<input value={hall.tag} onChange={(e) => setHall({ ...hall, tag: e.target.value })} /></label>
              <label>Seating (comma separated)<input value={hall.seating} onChange={(e) => setHall({ ...hall, seating: e.target.value })} /></label>
              <label className="check">
                Show on website / sellable
                <input type="checkbox" checked={hall.active !== false} onChange={(e) => setHall({ ...hall, active: e.target.checked })} />
              </label>
              <div className="row" style={{ marginTop: 10 }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    onHall(hall);
                    ping("Hall saved. Website venues and staff rates are updated.");
                    setHall(null);
                  }}
                >
                  Save hall
                </button>
                <button type="button" className="btn ghost" onClick={() => setHall(null)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "rooms" && (
        <div>
          <div className="panel">
            <div className="panel-head">
              <h3>Room types</h3>
              <button type="button" className="btn small" onClick={() => setRtype({ ...emptyType })}>+ Type</button>
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
                        ping("Room type saved. Reservations and the Rooms page will use it.");
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
                onClick={() => setRoom({ ...emptyRoom, typeId: state.roomTypes[0]?.id || "" })}
              >
                + Room
              </button>
            </div>
            <table>
              <thead>
                <tr><th>No.</th><th>Type</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {state.rooms.map((r) => (
                  <tr key={r.id} className="clickable" onClick={() => setRoom({ ...r })}>
                    <td>{r.number}</td>
                    <td>{state.roomTypes.find((t) => t.id === r.typeId)?.name}</td>
                    <td>{r.status}</td>
                    <td>
                      <button
                        type="button"
                        className="btn danger small"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!window.confirm(`Delete room ${r.number}?`)) return;
                          const out = onRemoveRoom?.(r.id);
                          if (out?.error) window.alert(out.error);
                          else {
                            ping(`Room ${r.number} deleted.`);
                            if (room?.id === r.id) setRoom(null);
                          }
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {room && (
              <div style={{ marginTop: 12 }}>
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
                      {["Available", "Reserved", "Occupied", "Out of order", "Maintenance"].map((s) => (
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
                      else ping("Room saved. Reservations and the Rooms page will use it.");
                      if (!out?.error) setRoom(null);
                    }}
                  >
                    Save room
                  </button>
                  <button type="button" className="btn ghost small" onClick={() => setRoom(null)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      </div>

      <div className="print-only master-letter">
        <strong>{sheetP.name}</strong>
        <div>{(sheetP.address || []).join(", ")}</div>
        <div>{sheetP.phone} · {sheetP.email}</div>
        <div>Master data · printed {formatDateDMY(todayISO())}</div>

        <h3>Property</h3>
        <table>
          <tbody>
            <tr><td>Name</td><td>{sheetP.name}</td></tr>
            <tr><td>Short name</td><td>{sheetP.brandName}</td></tr>
            <tr><td>Tagline</td><td>{sheetP.tagline}</td></tr>
            <tr><td>Place</td><td>{sheetP.place}</td></tr>
            <tr><td>Desk hours</td><td>{sheetP.desk}</td></tr>
            <tr><td>WhatsApp desk</td><td>{sheetP.notifyPhone || sheetP.phone}</td></tr>
            <tr><td>Gayatri GSTIN</td><td>{gstinText(sheetP.gstin)}</td></tr>
            <tr><td>Tax</td><td>{sheetP.taxName} {sheetP.taxPercent}% · {sheetP.currency}</td></tr>
            <tr>
              <td>Event types</td>
              <td>
                {(sheetP.eventTypes || []).length ? (
                  <ol className="master-event-order">
                    {(sheetP.eventTypes || []).map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ol>
                ) : "—"}
              </td>
            </tr>
          </tbody>
        </table>

        <h3>Halls</h3>
        <table>
          <thead>
            <tr>
              <th>Hall</th>
              <th>Capacity</th>
              <th>Half day</th>
              <th>Full day</th>
              <th>Minimum</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {(sheet.halls || []).map((h) => (
              <tr key={h.id}>
                <td>
                  {h.name}
                  <div className="muted">{h.code} · {h.kind} · {(h.seating || []).join(", ")}</div>
                </td>
                <td>{capacityText(h)}</td>
                <td>{sheetM(h.rates?.halfDay)}</td>
                <td>{sheetM(h.rates?.fullDay)}</td>
                <td>{sheetM(h.minValue)}</td>
                <td>{h.active === false ? "Off" : "On"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3>Room types</h3>
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Base rate</th>
              <th>Extra bed</th>
              <th>Max guests</th>
              <th>No. of rooms</th>
            </tr>
          </thead>
          <tbody>
            {(sheet.roomTypes || []).map((t) => {
              const mix = typeRoomMix(t);
              return (
              <tr key={t.id}>
                <td>{mix ? `${t.name} (${mix})` : t.name}</td>
                <td>{sheetM(t.baseRate)}</td>
                <td>{t.extraBed ? sheetM(t.extraBed) : "—"}</td>
                <td>{guestsText(t)}</td>
                <td>{typeListedRoomsCell(t, sheet.rooms)}</td>
              </tr>
            );})}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4}><strong>Total rooms</strong></td>
              <td><strong>{totalPhysicalRooms(sheet.rooms)}</strong></td>
            </tr>
          </tfoot>
        </table>

        <h3>Rooms</h3>
        <table>
          <thead>
            <tr>
              <th>No.</th>
              <th>Type</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {(sheet.rooms || []).map((r) => (
              <tr key={r.id}>
                <td>{r.number}</td>
                <td>{sheet.roomTypes.find((t) => t.id === r.typeId)?.name || "—"}</td>
                <td>{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3>Booking policies</h3>
        <table>
          <tbody>
            <tr><td>Advance</td><td>{sheetPol.advancePercent}%</td></tr>
            <tr><td>Cancellation charge</td><td>{sheetPol.cancellationPercent}%</td></tr>
            <tr><td>Refund advance on cancel</td><td>{sheetPol.refundAdvance ? "Yes" : "No"}</td></tr>
            <tr>
              <td>Cancellation summary</td>
              <td>
                {sheetPol.refundAdvance
                  ? `Refund may be allowed; charge ${sheetPol.cancellationPercent}% of booking total (or advance as written by desk).`
                  : "Advance is not refundable on guest cancel. No-show is treated as cancellation."}
              </td>
            </tr>
            <tr><td>Room check-in / check-out</td><td>{roomCheckInOutText(sheetPol)}</td></tr>
            <tr><td>Security deposit</td><td>{sheetM(sheetPol.securityDeposit)}</td></tr>
            <tr><td>Minimum hall amount</td><td>{sheetM(sheetPol.minHallAmount)}</td></tr>
            <tr><td>Payment due (days before event)</td><td>{sheetPol.paymentDueDays}</td></tr>
            <tr><td>Grace period</td><td>{sheetPol.graceMinutes} minutes</td></tr>
          </tbody>
        </table>

        <h3>Cancellation Policy (T&amp;C)</h3>
        <p className="muted" style={{ marginBottom: 8 }}>
          Figures from booking policies: advance {sheetPol.advancePercent}% · cancellation {sheetPol.cancellationPercent}% · refund on cancel {sheetPol.refundAdvance ? "Yes" : "No"}
        </p>
        <ol>
          {cancelSectionLines(sheetP, "en").map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>

        <h3>Terms &amp; Conditions v{sheetTerms.version}</h3>
        {TERM_LANGS.map((lang) => (
          <div key={lang.id} style={{ marginBottom: 18 }}>
            <strong>{lang.label}</strong>
            {TERM_SECTIONS.map((sec) => {
              const lines =
                sec.id === "cancel"
                  ? cancelSectionLines(sheetP, lang.id)
                  : sectionLines(sheetTerms.locales?.[lang.id]?.[sec.id] || sheetTerms.sections[sec.id], sheetP);
              if (!lines.length) return null;
              return (
                <div key={`${lang.id}-${sec.id}`} style={{ marginBottom: 12 }}>
                  <em>{sec.label}</em>
                  <ol>
                    {lines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ol>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}
