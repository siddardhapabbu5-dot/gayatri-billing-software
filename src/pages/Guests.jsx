import { useState } from "react";
import { bookingFolio } from "../engine";
import { formatDate, money } from "../lib";
import { PageHead, Pill } from "../ui";

export default function Guests({ state, onSave, go }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);
  const rows = state.guests.filter((g) => `${g.name} ${g.phone} ${g.email}`.toLowerCase().includes(q.toLowerCase()));
  const guest = state.guests.find((g) => g.id === open);

  if (guest) {
    const books = state.bookings.filter((b) => b.guestId === guest.id);
    return (
      <>
        <PageHead title={guest.name} sub="Customer 360 — enquiries, bookings, rooms, payments, invoices, documents">
          <button className="btn ghost" onClick={() => setOpen(null)}>All guests</button>
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
                <tr><td>Address</td><td>{guest.address}</td></tr>
                <tr><td>Emergency</td><td>{guest.emergency || "—"}</td></tr>
                <tr><td>Preferences</td><td>{guest.preferences || "—"}</td></tr>
                <tr><td>Tags</td><td>{(guest.tags || []).join(" · ")}</td></tr>
              </tbody>
            </table>
          </div>
          <div className="panel">
            <h3>History</h3>
            <table>
              <thead><tr><th>Booking</th><th>Date</th><th>Status</th><th>Balance</th><th></th></tr></thead>
              <tbody>
                {books.map((b) => {
                  const { totals } = bookingFolio(state, b.id);
                  return (
                    <tr key={b.id}>
                      <td>{b.number}<div className="muted">{b.type}</div></td>
                      <td>{formatDate(b.eventDate)}</td>
                      <td><Pill status={b.status} /></td>
                      <td>{money(totals.balance, state.property.currency, state.property.locale)}</td>
                      <td className="row">
                        <button className="btn small" onClick={() => go("billing", { bookingId: b.id })}>Payment</button>
                        <button className="btn ghost small" onClick={() => go("documents", { bookingId: b.id })}>Documents</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHead title="Guests / CRM" sub="Every guest profile carries ID, nationality, preferences and a full stay/event history.">
        <input placeholder="Search guest" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 240 }} />
        <button
          className="btn"
          onClick={() => {
            const name = window.prompt("Guest name");
            const phone = window.prompt("Phone");
            if (name && phone) onSave({ name, phone, email: "", nationality: "India", address: "", tags: ["Manual"] });
          }}
        >
          New guest
        </button>
      </PageHead>
      <div className="panel">
        <table>
          <thead><tr><th>Guest</th><th>Phone</th><th>Nationality</th><th>Tags</th><th>Bookings</th></tr></thead>
          <tbody>
            {rows.map((g) => (
              <tr key={g.id} className="clickable" onClick={() => setOpen(g.id)}>
                <td>{g.name}</td>
                <td>{g.phone}</td>
                <td>{g.nationality}</td>
                <td>{(g.tags || []).join(", ")}</td>
                <td>{state.bookings.filter((b) => b.guestId === g.id).length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
