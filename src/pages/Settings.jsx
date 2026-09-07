import { useState } from "react";
import { formatDateTime } from "../lib";
import { DEFAULT_POLICIES, TERM_LANGS, TERM_SECTIONS, policiesOf, termSetsOf } from "../policies";
import { PageHead } from "../ui";

const INTEGRATIONS = [
  { name: "Payment gateway", note: "UPI, cards, net banking, international cards — connect in Phase 4." },
  { name: "WhatsApp / SMS / Call", note: "Website bookings open WhatsApp to the desk number. Staff can also WhatsApp or call the guest from Reservations." },
  { name: "Accounting", note: "Tally / QuickBooks / Xero export via invoice documents." },
  { name: "Channel manager", note: "OTA / room mapping — Phase 5." },
  { name: "Google Calendar / Maps", note: "Sync event holds — Phase 5." },
  { name: "Door locks / access / CCTV", note: "IoT adapters — Phase 5." },
];

const TABS = [
  ["property", "Property"],
  ["terms", "Terms & Conditions"],
  ["policies", "Booking policies"],
  ["agreements", "Guest agreements"],
  ["system", "Users & audit"],
];

export default function Settings({ state, onProperty, onPublishTerms, onUser, onReset, onClearBookings }) {
  const p = state.property;
  const [tab, setTab] = useState("terms");
  const [sec, setSec] = useState("hall");
  const [termLang, setTermLang] = useState("en");
  const [note, setNote] = useState("");
  const [locales, setLocales] = useState(() => termSetsOf(p).locales);
  const [pol, setPol] = useState(() => policiesOf(p));
  const sets = termSetsOf(p);

  function ping(msg) {
    setNote(msg);
    window.setTimeout(() => setNote(""), 3200);
  }

  function savePolicies() {
    onProperty({ policies: pol });
    ping("Booking policies saved. Reservations and bills will use these numbers.");
  }

  function publishTerms() {
    onPublishTerms({ sections: locales.en, locales });
    ping("Terms published in English, Telugu and Hindi. New bookings store this version.");
  }

  return (
    <>
      <PageHead title="Settings" sub="Property, terms, booking policies, guest agreements, users and audit." />
      {note && <p className="pill ok" style={{ marginBottom: 10 }}>{note}</p>}
      <div className="chips" style={{ marginBottom: 12 }}>
        {TABS.map(([id, label]) => (
          <button key={id} type="button" className={`chip${tab === id ? " on" : ""}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === "property" && (
        <div className="g2">
          <div className="panel">
            <h3>Property</h3>
            <div className="fields two">
              <label>Name<input defaultValue={p.name} onBlur={(e) => onProperty({ name: e.target.value })} /></label>
              <label>Phone<input defaultValue={p.phone} onBlur={(e) => onProperty({ phone: e.target.value })} /></label>
              <label>WhatsApp / SMS desk
                <input defaultValue={p.notifyPhone || p.phone} onBlur={(e) => onProperty({ notifyPhone: e.target.value })} />
              </label>
              <label className="check">
                Open WhatsApp on website booking
                <input type="checkbox" defaultChecked={p.notifyWhatsApp !== false} onChange={(e) => onProperty({ notifyWhatsApp: e.target.checked })} />
              </label>
              <label>Currency<input defaultValue={p.currency} onBlur={(e) => onProperty({ currency: e.target.value.toUpperCase() })} /></label>
              <label>Tax name<input defaultValue={p.taxName} onBlur={(e) => onProperty({ taxName: e.target.value })} /></label>
              <label>Tax %<input type="number" defaultValue={p.taxPercent} onBlur={(e) => onProperty({ taxPercent: Number(e.target.value) || 0 })} /></label>
              <label>Timezone<input defaultValue={p.timezone} onBlur={(e) => onProperty({ timezone: e.target.value })} /></label>
              <label>Gayatri GSTIN<input defaultValue={p.gstin} onBlur={(e) => onProperty({ gstin: e.target.value.trim().toUpperCase() })} /></label>
              <label>Language<input defaultValue={p.language} onBlur={(e) => onProperty({ language: e.target.value })} /></label>
            </div>
          </div>
          <div className="panel">
            <h3>Integrations (API layer)</h3>
            <table>
              <tbody>
                {INTEGRATIONS.map((i) => (
                  <tr key={i.name}><td>{i.name}</td><td className="muted">{i.note}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "terms" && (
        <div className="panel">
          <h3>Terms & Conditions master</h3>
          <p className="muted">
            Current published version: v{sets.version}
            {sets.publishedAt ? ` · ${formatDateTime(sets.publishedAt)}` : " · not published yet"}.
            Edit English, Telugu or Hindi, then Publish. Guests can read all three on the website Terms page.
          </p>
          <div className="chips" style={{ margin: "10px 0" }}>
            {TERM_LANGS.map((l) => (
              <button key={l.id} type="button" className={`chip${termLang === l.id ? " on" : ""}`} onClick={() => setTermLang(l.id)}>
                {l.label}
              </button>
            ))}
          </div>
          <div className="chips" style={{ margin: "10px 0" }}>
            {TERM_SECTIONS.map((s) => (
              <button key={s.id} type="button" className={`chip${sec === s.id ? " on" : ""}`} onClick={() => setSec(s.id)}>
                {s.label}
              </button>
            ))}
          </div>
          <label>
            {TERM_SECTIONS.find((s) => s.id === sec)?.label} — {TERM_LANGS.find((l) => l.id === termLang)?.label} (one clause per line)
            <textarea
              className={`terms-edit lang-${termLang}`}
              value={locales[termLang]?.[sec] || ""}
              onChange={(e) =>
                setLocales({
                  ...locales,
                  [termLang]: { ...locales[termLang], [sec]: e.target.value },
                })
              }
              style={{ minHeight: 220 }}
            />
          </label>
          <p className="muted" style={{ marginTop: 8 }}>
            These are a software / business-policy template, not a substitute for a lawyer's contract.
            Have the final version reviewed for Andhra Pradesh / India law before using them as a binding agreement.
          </p>
          <button className="btn" type="button" style={{ marginTop: 8 }} onClick={publishTerms}>
            Publish terms (new version)
          </button>
        </div>
      )}

      {tab === "policies" && (
        <div className="panel">
          <h3>Booking policies</h3>
          <p className="muted">Do not hard-code these on the reservation screen. The desk can change them here.</p>
          <div className="fields two">
            <label>Advance %<input type="number" value={pol.advancePercent} onChange={(e) => setPol({ ...pol, advancePercent: Number(e.target.value) || 0 })} /></label>
            <label>Cancellation charge % (legacy flat)<input type="number" value={pol.cancellationPercent} onChange={(e) => setPol({ ...pol, cancellationPercent: Number(e.target.value) || 0 })} /></label>
            <label className="check">
              Refund advance on cancel (legacy)
              <input type="checkbox" checked={!!pol.refundAdvance} onChange={(e) => setPol({ ...pol, refundAdvance: e.target.checked })} />
            </label>
            <label>
              Manager approval above ₹
              <input
                type="number"
                value={pol.refundApprovalAbove ?? 5000}
                onChange={(e) => setPol({ ...pol, refundApprovalAbove: Number(e.target.value) || 0 })}
              />
            </label>
            <label>Room check-in / check-out
              <input value={pol.roomCheckInOut || ""} onChange={(e) => setPol({ ...pol, roomCheckInOut: e.target.value })} placeholder="24 hrs" />
            </label>
            <label>Extra-person charge<input type="number" value={pol.extraPersonCharge} onChange={(e) => setPol({ ...pol, extraPersonCharge: Number(e.target.value) || 0 })} /></label>
            <label>Security deposit<input type="number" value={pol.securityDeposit} onChange={(e) => setPol({ ...pol, securityDeposit: Number(e.target.value) || 0 })} /></label>
            <label>Minimum hall amount<input type="number" value={pol.minHallAmount} onChange={(e) => setPol({ ...pol, minHallAmount: Number(e.target.value) || 0 })} /></label>
            <label>Payment due (days before event)<input type="number" value={pol.paymentDueDays} onChange={(e) => setPol({ ...pol, paymentDueDays: Number(e.target.value) || 0 })} /></label>
            <label>Grace period (minutes)<input type="number" value={pol.graceMinutes} onChange={(e) => setPol({ ...pol, graceMinutes: Number(e.target.value) || 0 })} /></label>
          </div>
          <h4 style={{ marginTop: 16 }}>Cancellation tiers (days before event)</h4>
          <p className="muted">Used when cancelling from Payment &amp; Invoice. Highest matching “min days” wins.</p>
          <table>
            <thead>
              <tr>
                <th>Label</th>
                <th>Min days</th>
                <th>Refund %</th>
                <th>Fixed fee</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(pol.cancelTiers || []).map((tier, idx) => (
                <tr key={tier.id || idx}>
                  <td>
                    <input
                      value={tier.label || ""}
                      onChange={(e) => {
                        const cancelTiers = [...(pol.cancelTiers || [])];
                        cancelTiers[idx] = { ...tier, label: e.target.value };
                        setPol({ ...pol, cancelTiers });
                      }}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={tier.minDays}
                      onChange={(e) => {
                        const cancelTiers = [...(pol.cancelTiers || [])];
                        cancelTiers[idx] = { ...tier, minDays: Number(e.target.value) || 0 };
                        setPol({ ...pol, cancelTiers });
                      }}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={tier.refundPercent}
                      onChange={(e) => {
                        const cancelTiers = [...(pol.cancelTiers || [])];
                        cancelTiers[idx] = { ...tier, refundPercent: Number(e.target.value) || 0 };
                        setPol({ ...pol, cancelTiers });
                      }}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={tier.fixedFee || 0}
                      onChange={(e) => {
                        const cancelTiers = [...(pol.cancelTiers || [])];
                        cancelTiers[idx] = { ...tier, fixedFee: Number(e.target.value) || 0 };
                        setPol({ ...pol, cancelTiers });
                      }}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn danger small"
                      onClick={() => {
                        const cancelTiers = (pol.cancelTiers || []).filter((_, i) => i !== idx);
                        setPol({ ...pol, cancelTiers });
                      }}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            type="button"
            className="btn ghost small"
            style={{ marginTop: 8 }}
            onClick={() =>
              setPol({
                ...pol,
                cancelTiers: [
                  ...(pol.cancelTiers || []),
                  { id: `t${Date.now()}`, minDays: 0, refundPercent: 0, fixedFee: 0, label: "New tier" },
                ],
              })
            }
          >
            + Add tier
          </button>
          <p className="muted" style={{ marginTop: 8 }}>
            Tax % is on Property. Extra bed rate is on each room type in Master data. Gayatri does not sell catering from this desk — catering policy is T&C only.
          </p>
          <button className="btn" type="button" style={{ marginTop: 8 }} onClick={savePolicies}>Save policies</button>
          <button className="btn ghost" type="button" style={{ marginTop: 8, marginLeft: 8 }} onClick={() => setPol({ ...DEFAULT_POLICIES })}>Reset to defaults</button>
        </div>
      )}

      {tab === "agreements" && (
        <div className="panel">
          <h3>Customer agreements</h3>
          <p className="muted">Date/time, user, booking ID and T&C version. Used if a guest later disputes the terms they agreed to.</p>
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Booking</th>
                <th>Guest</th>
                <th>User</th>
                <th>Version</th>
                <th>Sections</th>
              </tr>
            </thead>
            <tbody>
              {(state.agreements || []).slice(0, 80).map((a) => {
                const bk = state.bookings.find((b) => b.id === a.bookingId);
                const g = state.guests.find((x) => x.id === a.guestId);
                return (
                  <tr key={a.id}>
                    <td>{formatDateTime(a.at)}</td>
                    <td>{bk?.number || a.bookingId}</td>
                    <td>{g?.name || "—"}</td>
                    <td>{a.user}{a.source ? ` · ${a.source}` : ""}</td>
                    <td>v{a.version}</td>
                    <td>{(a.sections || []).map((id) => TERM_SECTIONS.find((s) => s.id === id)?.label || id).join(", ")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!(state.agreements || []).length && <p className="muted">No agreements yet. Confirm a reservation or a website booking with the T&C boxes ticked.</p>}
        </div>
      )}

      {tab === "system" && (
        <>
          <div className="g2">
            <div className="panel">
              <h3>Users & roles</h3>
              <table>
                <tbody>
                  {state.users.map((u) => (
                    <tr key={u.id}>
                      <td>{u.name}</td>
                      <td className="muted">{u.email}</td>
                      <td>{u.role}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="muted" style={{ marginTop: 8 }}>Roles: Administrator, Manager, Front desk, Housekeeping, Accounts. Switch user in the left footer.</p>
              {onClearBookings ? (
                <button className="btn danger small" style={{ marginTop: 8, marginRight: 8 }} type="button" onClick={onClearBookings}>
                  Clear all bookings (dashboard zero)
                </button>
              ) : null}
              <button className="btn danger small" style={{ marginTop: 8 }} type="button" onClick={onReset}>Reload demo property data</button>
            </div>
            <div className="panel">
              <h3>Document storage</h3>
              <p className="muted">
                Guest ID, hall contracts and payment proofs are saved on this computer (browser IndexedDB). View in the software,
                Save copy to Downloads, or re-upload if you open Gayatri on another PC. PDF or image up to 8 MB; video (MP4, MOV, WebM) up to 100 MB.
              </p>
            </div>
          </div>
          <div className="panel" style={{ marginTop: 12 }}>
            <h3>Audit log</h3>
            <table>
              <thead><tr><th>When</th><th>User</th><th>Action</th><th>Entity</th><th>Detail</th></tr></thead>
              <tbody>
                {state.audit.slice(0, 40).map((a) => (
                  <tr key={a.id}>
                    <td>{formatDateTime(a.at)}</td>
                    <td>{a.user}</td>
                    <td>{a.action}</td>
                    <td>{a.entity}</td>
                    <td className="muted">{a.detail}{a.oldValue != null ? ` (${a.oldValue} → ${a.newValue})` : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
