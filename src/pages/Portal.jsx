import { useState } from "react";
import { capacityText, money, todayISO } from "../lib";
import { PageHead } from "../ui";

export default function Portal({ state, onEnquire, onBack }) {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    date: todayISO(),
    hall: state.halls[0]?.name,
    guests: 300,
    type: "Conference",
    message: "",
  });
  const [done, setDone] = useState(null);

  return (
    <div className="portal">
      <div className="portal-hero">
        <div className="muted" style={{ letterSpacing: ".2em", textTransform: "uppercase" }}>Visit & book</div>
        <h1>{state.property.name}</h1>
        <p>{state.property.place}</p>
        <p className="muted">{state.property.address.join(" · ")}</p>
        <p>{state.property.phone} · {state.property.email}</p>
        <p>{state.property.desk}</p>
        {onBack && (
          <button className="btn" style={{ marginTop: 12 }} onClick={onBack}>
            Staff login
          </button>
        )}
      </div>
      <PageHead title="Check date · hall · rooms" sub="Online enquiry posts into the same VHMS. Payment gateway and WhatsApp confirmation connect in Phase 4." />
      <div className="g3" style={{ marginBottom: 16 }}>
        {state.halls.map((h) => (
          <div key={h.id} className="panel">
            <h3>{h.name}</h3>
            <p className="muted">{capacityText(h)} · {h.parking} parking · {h.kind}</p>
            <p>{money(h.rates.fullDay, state.property.currency, state.property.locale)} / 24 hours</p>
          </div>
        ))}
      </div>
      <div className="panel">
        {done ? (
          <p>Request {done} received. The desk will send a quotation.</p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const out = onEnquire(form);
              setDone(out?.booking?.number);
            }}
          >
            <div className="fields">
              <label>Name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
              <label>Phone<input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
              <label>Email<input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
              <label>Date<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
              <label>Hall
                <select value={form.hall} onChange={(e) => setForm({ ...form, hall: e.target.value })}>
                  {state.halls.map((h) => <option key={h.id}>{h.name}</option>)}
                </select>
              </label>
              <label>Guests
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={form.guests}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "") {
                      setForm({ ...form, guests: "" });
                      return;
                    }
                    const n = Number(raw);
                    if (!Number.isFinite(n) || n < 1) {
                      setForm({ ...form, guests: 1 });
                      return;
                    }
                    setForm({ ...form, guests: Math.floor(n) });
                  }}
                />
              </label>
            </div>
            <label style={{ marginTop: 10 }}>Message
              <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
            </label>
            <button className="btn" type="submit" style={{ marginTop: 12 }}>Request booking</button>
          </form>
        )}
      </div>
    </div>
  );
}
