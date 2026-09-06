import { useState } from "react";
import { bookingFolio } from "../engine";
import { formatDate, formatDateTime, money } from "../lib";
import { PageHead, Pill } from "../ui";

const emptyForm = {
  id: "",
  name: "",
  phone: "",
  email: "",
  nationality: "India",
  idType: "Aadhaar",
  idNumber: "",
  address: "",
  emergency: "",
  preferences: "",
  gstin: "",
  tags: ["Manual"],
};

function toForm(guest) {
  return {
    id: guest.id || "",
    name: guest.name || "",
    phone: guest.phone || "",
    email: guest.email || "",
    nationality: guest.nationality || "India",
    idType: guest.idProof?.type || "Aadhaar",
    idNumber: guest.idProof?.number || "",
    address: guest.address || "",
    emergency: guest.emergency || "",
    preferences: guest.preferences || "",
    gstin: guest.gstin || "",
    tags: guest.tags?.length ? [...guest.tags] : ["Manual"],
  };
}

export default function Guests({ state, onSave, onRemove, go, focusId }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(focusId || null);
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const liveCount = (id) => state.bookings.filter((b) => b.guestId === id && b.status !== "Cancelled").length;
  const rows = state.guests.filter((g) => {
    if (!`${g.name} ${g.phone} ${g.email}`.toLowerCase().includes(q.toLowerCase())) return false;
    const books = state.bookings.filter((b) => b.guestId === g.id);
    const live = books.filter((b) => b.status !== "Cancelled");
    return live.length > 0 || books.length === 0;
  });

  function askDelete(g) {
    const n = liveCount(g.id);
    const msg = n
      ? `Delete ${g.name}? Their ${n} booking(s) will also leave Reservations and Payment & Invoice.`
      : `Delete ${g.name}?`;
    if (!window.confirm(msg)) return;
    onRemove(g.id);
    setOpen(null);
    setForm(null);
  }
  const guest = state.guests.find((g) => g.id === open);

  function submit(e) {
    e.preventDefault();
    const phoneOk = /^[0-9+\-\s]{10,15}$/.test(form.phone.trim());
    if (!form.name.trim() || !phoneOk) {
      setError(form.name.trim() ? "Enter a valid 10-digit phone number." : "Enter the guest name.");
      return;
    }
    const payload = {
      ...(form.id ? { id: form.id } : {}),
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      nationality: form.nationality,
      idProof: { type: form.idType, number: form.idNumber.trim() },
      address: form.address.trim(),
      emergency: form.emergency.trim(),
      preferences: form.preferences.trim(),
      gstin: form.gstin.trim().toUpperCase(),
      tags: form.tags,
    };
    const out = onSave(payload);
    setError("");
    setForm(null);
    setOpen(out?.guest?.id || form.id || null);
  }

  if (form) {
    return (
      <>
        <PageHead title={form.id ? "Edit guest" : "New guest"} sub="Name, phone, ID and address for the desk file.">
          <button className="btn ghost" type="button" onClick={() => { setForm(null); setError(""); }}>
            Cancel
          </button>
        </PageHead>
        <form className="form" onSubmit={submit}>
          <div className="panel">
            <h3>Guest</h3>
            <div className="fields two">
              <label>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus /></label>
              <label>Phone<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
              <label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
              <label>Nationality
                <select value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })}>
                  <option>India</option>
                  <option>Other</option>
                </select>
              </label>
              <label>ID type
                <select value={form.idType} onChange={(e) => setForm({ ...form, idType: e.target.value })}>
                  {["Aadhaar", "Passport", "Driving licence", "Voter ID", "PAN"].map((t) => <option key={t}>{t}</option>)}
                </select>
              </label>
              <label>ID number<input value={form.idNumber} onChange={(e) => setForm({ ...form, idNumber: e.target.value })} /></label>
              <label>Customer GST<input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} placeholder="GSTIN if billed to a company" /></label>
              <label>Address<input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
              <label>Emergency<input value={form.emergency} onChange={(e) => setForm({ ...form, emergency: e.target.value })} /></label>
              <label style={{ gridColumn: "1 / -1" }}>
                Preferences
                <input value={form.preferences} onChange={(e) => setForm({ ...form, preferences: e.target.value })} />
              </label>
            </div>
            {error ? <p className="muted" style={{ color: "var(--due)", margin: "10px 0 0" }}>{error}</p> : null}
            <button className="btn" type="submit" style={{ marginTop: 12 }}>
              {form.id ? "Save guest" : "Save guest"}
            </button>
          </div>
        </form>
      </>
    );
  }

  if (guest) {
    const books = state.bookings.filter((b) => b.guestId === guest.id && b.status !== "Cancelled");
    return (
      <>
        <PageHead title={guest.name} sub="This guest’s bookings. Date, status and balance come from Reservations and Payment & Invoice.">
          <button className="btn ghost" onClick={() => setOpen(null)}>All guests</button>
          <button className="btn ghost" onClick={() => setForm(toForm(guest))}>Edit</button>
          <button className="btn danger" onClick={() => askDelete(guest)}>Delete</button>
          <button className="btn" onClick={() => go("reserve", { guestId: guest.id })}>New booking</button>
        </PageHead>
        <div className="g2">
          <div className="panel">
            <h3>Profile</h3>
            <table>
              <tbody>
                <tr><td>Phone</td><td>{guest.phone}</td></tr>
                <tr><td>Email</td><td>{guest.email || "—"}</td></tr>
                <tr><td>Nationality</td><td>{guest.nationality}</td></tr>
                <tr><td>ID</td><td>{guest.idProof?.type} {guest.idProof?.number}</td></tr>
                <tr><td>Customer GST</td><td>{guest.gstin || "—"}</td></tr>
                <tr><td>Address</td><td>{guest.address}</td></tr>
                <tr><td>Emergency</td><td>{guest.emergency || "—"}</td></tr>
                <tr><td>Preferences</td><td>{guest.preferences || "—"}</td></tr>
                <tr><td>Tags</td><td>{(guest.tags || []).join(" · ")}</td></tr>
              </tbody>
            </table>
          </div>
          <div className="panel">
            <h3>History</h3>
            {books.length === 0 ? (
              <div className="empty">
                <p>No booking yet for this guest.</p>
                <p className="muted">Book them on Reservations. Then date, status and balance show in this list, and the bill shows in Payment & Invoice.</p>
                <button className="btn" type="button" onClick={() => go("reserve", { guestId: guest.id })}>
                  New booking
                </button>
              </div>
            ) : (
            <table>
              <thead><tr><th>Booking</th><th>Stay date</th><th>Last paid</th><th>Status</th><th>Balance</th><th></th></tr></thead>
              <tbody>
                {books.map((b) => {
                  const { pays, totals } = bookingFolio(state, b.id);
                  const lastPay = pays.filter((p) => p.at).sort((a, c) => String(c.at).localeCompare(String(a.at)))[0];
                  return (
                    <tr key={b.id}>
                      <td>{b.number}<div className="muted">{b.type}</div></td>
                      <td>{formatDate(b.eventDate)}</td>
                      <td>{lastPay ? formatDateTime(lastPay.at) : "—"}</td>
                      <td><Pill status={b.status} /></td>
                      <td>{money(totals.balance, state.property.currency, state.property.locale)}</td>
                      <td className="row">
                        <button className="btn small" onClick={() => go("billing", { bookingId: b.id, fromGuestId: guest.id })}>Payment</button>
                        <button className="btn ghost small" onClick={() => go("documents", { bookingId: b.id, fromGuestId: guest.id })}>Documents</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            )}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHead title="Guests / CRM" sub="Step 3 — Guests appear here after you confirm a reservation.">
        <input placeholder="Search guest" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 240 }} />
        <button className="btn ghost" type="button" onClick={() => { setError(""); setForm({ ...emptyForm }); }}>
          New guest
        </button>
        <button className="btn" type="button" onClick={() => go("reserve")}>
          New booking
        </button>
      </PageHead>
      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>Guest</th>
              <th>Phone</th>
              <th>Customer GST</th>
              <th>Nationality</th>
              <th>Tags</th>
              <th>Bookings</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((g) => (
              <tr key={g.id} className="clickable" onClick={() => setOpen(g.id)}>
                <td>{g.name}</td>
                <td>{g.phone}</td>
                <td>{g.gstin || "—"}</td>
                <td>{g.nationality}</td>
                <td>{(g.tags || []).join(", ")}</td>
                <td>{liveCount(g.id)}</td>
                <td className="row" onClick={(e) => e.stopPropagation()}>
                  <button className="btn small" type="button" onClick={() => setForm(toForm(g))}>Edit</button>
                  <button className="btn danger small" type="button" onClick={() => askDelete(g)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
