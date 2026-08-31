import { useState } from "react";
import { money } from "../lib";
import { PageHead } from "../ui";

const TABS = [
  ["property", "Property & website"],
  ["halls", "Halls"],
  ["rooms", "Rooms"],
  ["packages", "Packages"],
];

const emptyHall = {
  name: "",
  code: "",
  kind: "Indoor",
  tag: "",
  jp: "",
  copy: "",
  capacity: 200,
  floating: 250,
  dining: 150,
  parking: 40,
  setupHours: 2,
  teardownHours: 1,
  bufferMinutes: 30,
  minValue: 0,
  rates: { hourly: 0, halfDay: 0, fullDay: 0 },
  seating: "Banquet",
  webPhoto: "",
  photo: "",
  active: true,
};

const emptyRoom = { number: "", floor: 1, typeId: "", status: "Available" };
const emptyType = { name: "", baseRate: 0, extraBed: 0, childRate: 0, maxGuests: 3 };
const emptyPkg = { name: "", price: 0, minGuests: 0, hallId: "", includes: "" };

export default function Master({ state, onProperty, onHall, onRoomType, onRoom, onPackage, onRemovePackage }) {
  const [tab, setTab] = useState("property");
  const [note, setNote] = useState("");
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
    terms: p.terms || "",
    mapQuery: p.mapQuery || "",
    eventTypes: (p.eventTypes || []).join("\n"),
    stories: (p.stories || []).map((s) => `${s.cite || ""}\n${s.quote || ""}`).join("\n---\n"),
  }));
  const [hall, setHall] = useState(null);
  const [room, setRoom] = useState(null);
  const [rtype, setRtype] = useState(null);
  const [pkg, setPkg] = useState(null);
  const cur = p.currency;
  const loc = p.locale;
  const m = (n) => money(n, cur, loc);

  function ping(msg) {
    setNote(msg);
    window.setTimeout(() => setNote(""), 2800);
  }

  function saveProperty() {
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
      gstin: prop.gstin,
      taxName: prop.taxName,
      taxPercent: Number(prop.taxPercent) || 0,
      currency: String(prop.currency || "INR").toUpperCase(),
      about: prop.about,
      banquetIntro: prop.banquetIntro,
      terms: prop.terms,
      mapQuery: prop.mapQuery,
      eventTypes: String(prop.eventTypes || "").split("\n").map((l) => l.trim()).filter(Boolean),
      stories,
    });
    ping("Saved. Staff and website will use this now.");
  }

  function pickHall(h) {
    setHall({
      ...emptyHall,
      ...h,
      seating: (h.seating || []).join(", "),
      rates: { hourly: h.rates?.hourly || 0, halfDay: h.rates?.halfDay || 0, fullDay: h.rates?.fullDay || 0 },
    });
  }

  return (
    <>
      <PageHead title="Master data" sub="Change halls, rooms, packages and website text here. It updates the staff software and the public site." />
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
            <label>GSTIN<input value={prop.gstin} onChange={(e) => setProp({ ...prop, gstin: e.target.value })} /></label>
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
          <label>
            Packages page text
            <textarea value={prop.banquetIntro} onChange={(e) => setProp({ ...prop, banquetIntro: e.target.value })} />
          </label>
          <label>
            Terms and conditions (website Book page, Terms page, and printed invoices — one clause per line)
            <textarea value={prop.terms} onChange={(e) => setProp({ ...prop, terms: e.target.value })} style={{ minHeight: 180 }} />
          </label>
          <label>
            Google Maps search
            <input value={prop.mapQuery} onChange={(e) => setProp({ ...prop, mapQuery: e.target.value })} />
          </label>
          <label>
            Occasion list (website Book form — one per line)
            <textarea value={prop.eventTypes} onChange={(e) => setProp({ ...prop, eventTypes: e.target.value })} />
          </label>
          <label>
            Guest stories (optional — not on the website yet. Add real reviews later when guests write to you.)
            <textarea value={prop.stories} onChange={(e) => setProp({ ...prop, stories: e.target.value })} style={{ minHeight: 140 }} />
          </label>
          <button className="btn" type="button" style={{ marginTop: 10 }} onClick={saveProperty}>
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
                <tr><th>Name</th><th>Capacity</th><th>Full day</th><th></th></tr>
              </thead>
              <tbody>
                {state.halls.map((h) => (
                  <tr key={h.id} className="clickable" onClick={() => pickHall(h)}>
                    <td>{h.name}<div className="muted">{h.kind}</div></td>
                    <td>{h.capacity}</td>
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
                <label>Capacity<input type="number" value={hall.capacity} onChange={(e) => setHall({ ...hall, capacity: e.target.value })} /></label>
                <label>Floating<input type="number" value={hall.floating} onChange={(e) => setHall({ ...hall, floating: e.target.value })} /></label>
                <label>Dining<input type="number" value={hall.dining} onChange={(e) => setHall({ ...hall, dining: e.target.value })} /></label>
                <label>Parking<input type="number" value={hall.parking} onChange={(e) => setHall({ ...hall, parking: e.target.value })} /></label>
                <label>Hourly rate<input type="number" value={hall.rates.hourly} onChange={(e) => setHall({ ...hall, rates: { ...hall.rates, hourly: e.target.value } })} /></label>
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
        <div className="g2">
          <div className="panel">
            <div className="panel-head">
              <h3>Room types</h3>
              <button type="button" className="btn small" onClick={() => setRtype({ ...emptyType })}>+ Type</button>
            </div>
            <table>
              <tbody>
                {state.roomTypes.map((t) => (
                  <tr key={t.id} className="clickable" onClick={() => setRtype({ ...t })}>
                    <td>{t.name}</td>
                    <td className="num">{m(t.baseRate)} / night</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rtype && (
              <div style={{ marginTop: 12 }}>
                <div className="fields two">
                  <label>Name<input value={rtype.name} onChange={(e) => setRtype({ ...rtype, name: e.target.value })} /></label>
                  <label>Night rate<input type="number" value={rtype.baseRate} onChange={(e) => setRtype({ ...rtype, baseRate: e.target.value })} /></label>
                  <label>Extra bed<input type="number" value={rtype.extraBed} onChange={(e) => setRtype({ ...rtype, extraBed: e.target.value })} /></label>
                  <label>Max guests<input type="number" value={rtype.maxGuests} onChange={(e) => setRtype({ ...rtype, maxGuests: e.target.value })} /></label>
                </div>
                <div className="row" style={{ marginTop: 8 }}>
                  <button type="button" className="btn small" onClick={() => { onRoomType(rtype); ping("Room type saved."); setRtype(null); }}>Save type</button>
                  <button type="button" className="btn ghost small" onClick={() => setRtype(null)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
          <div className="panel">
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
                <tr><th>No.</th><th>Type</th><th>Floor</th><th>Status</th></tr>
              </thead>
              <tbody>
                {state.rooms.map((r) => (
                  <tr key={r.id} className="clickable" onClick={() => setRoom({ ...r })}>
                    <td>{r.number}</td>
                    <td>{state.roomTypes.find((t) => t.id === r.typeId)?.name}</td>
                    <td>{r.floor}</td>
                    <td>{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {room && (
              <div style={{ marginTop: 12 }}>
                <div className="fields two">
                  <label>Number<input value={room.number} onChange={(e) => setRoom({ ...room, number: e.target.value })} /></label>
                  <label>Floor<input type="number" value={room.floor} onChange={(e) => setRoom({ ...room, floor: e.target.value })} /></label>
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
                      {["Available", "Reserved", "Occupied", "Dirty", "Cleaning", "Inspected", "Maintenance", "Out of order"].map((s) => (
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
                      else ping("Room saved. Reservations and room rack will use it.");
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

      {tab === "packages" && (
        <div className="g2">
          <div className="panel">
            <div className="panel-head">
              <h3>Packages</h3>
              <button type="button" className="btn small" onClick={() => setPkg({ ...emptyPkg, hallId: state.halls[0]?.id || "" })}>+ Package</button>
            </div>
            <table>
              <tbody>
                {state.packages.map((row) => (
                  <tr key={row.id} className="clickable" onClick={() => setPkg({ ...row, includes: (row.includes || []).join("\n") })}>
                    <td>{row.name}<div className="muted">{(row.includes || []).join(" · ")}</div></td>
                    <td className="num">{m(row.price)}</td>
                    <td>
                      <button
                        type="button"
                        className="btn danger small"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`Remove ${row.name}?`)) {
                            onRemovePackage(row.id);
                            ping("Package removed.");
                            setPkg(null);
                          }
                        }}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pkg && (
            <div className="panel">
              <h3>{pkg.id ? "Edit package" : "New package"}</h3>
              <div className="fields two">
                <label>Name<input value={pkg.name} onChange={(e) => setPkg({ ...pkg, name: e.target.value })} /></label>
                <label>Price<input type="number" value={pkg.price} onChange={(e) => setPkg({ ...pkg, price: e.target.value })} /></label>
                <label>Min guests<input type="number" value={pkg.minGuests} onChange={(e) => setPkg({ ...pkg, minGuests: e.target.value })} /></label>
                <label>
                  Linked hall
                  <select value={pkg.hallId} onChange={(e) => setPkg({ ...pkg, hallId: e.target.value })}>
                    <option value="">None</option>
                    {state.halls.map((h) => (
                      <option key={h.id} value={h.id}>{h.name}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label>Includes (one per line)<textarea value={pkg.includes} onChange={(e) => setPkg({ ...pkg, includes: e.target.value })} /></label>
              <div className="row" style={{ marginTop: 10 }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    const out = onPackage(pkg);
                    if (out?.error) window.alert(out.error);
                    else ping("Package saved. Website Banquets and Book form will show it.");
                    if (!out?.error) setPkg(null);
                  }}
                >
                  Save package
                </button>
                <button type="button" className="btn ghost" onClick={() => setPkg(null)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
