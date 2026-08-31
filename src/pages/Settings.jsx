import { formatDateTime } from "../lib";
import { PageHead } from "../ui";

const INTEGRATIONS = [
  { name: "Payment gateway", note: "UPI, cards, net banking, international cards — connect in Phase 4." },
  { name: "WhatsApp / SMS / Call", note: "Website bookings open WhatsApp to the desk number. Staff can also WhatsApp or call the guest from Reservations." },
  { name: "Accounting", note: "Tally / QuickBooks / Xero export via invoice documents." },
  { name: "Channel manager", note: "OTA / room mapping — Phase 5." },
  { name: "Google Calendar / Maps", note: "Sync event holds — Phase 5." },
  { name: "Door locks / access / CCTV", note: "IoT adapters — Phase 5." },
];

export default function Settings({ state, onProperty, onUser, onReset }) {
  const p = state.property;
  return (
    <>
      <PageHead title="Enterprise settings" sub="Multi-currency and tax are property-level. Company → group → property is already in the data model for later branches." />
      <div className="g2">
        <div className="panel">
          <h3>Property</h3>
          <div className="fields two">
            <label>Name<input defaultValue={p.name} onBlur={(e) => onProperty({ name: e.target.value })} /></label>
            <label>Phone<input defaultValue={p.phone} onBlur={(e) => onProperty({ phone: e.target.value })} /></label>
            <label>WhatsApp / SMS desk
              <input
                defaultValue={p.notifyPhone || p.phone}
                onBlur={(e) => onProperty({ notifyPhone: e.target.value })}
              />
            </label>
            <label className="check">
              Open WhatsApp on website booking
              <input
                type="checkbox"
                defaultChecked={p.notifyWhatsApp !== false}
                onChange={(e) => onProperty({ notifyWhatsApp: e.target.checked })}
              />
            </label>
            <label>Currency<input defaultValue={p.currency} onBlur={(e) => onProperty({ currency: e.target.value.toUpperCase() })} /></label>
            <label>Tax name<input defaultValue={p.taxName} onBlur={(e) => onProperty({ taxName: e.target.value })} /></label>
            <label>Tax %<input type="number" defaultValue={p.taxPercent} onBlur={(e) => onProperty({ taxPercent: Number(e.target.value) || 0 })} /></label>
            <label>Timezone<input defaultValue={p.timezone} onBlur={(e) => onProperty({ timezone: e.target.value })} /></label>
            <label>GSTIN / tax ID<input defaultValue={p.gstin} onBlur={(e) => onProperty({ gstin: e.target.value })} /></label>
            <label>Language<input defaultValue={p.language} onBlur={(e) => onProperty({ language: e.target.value })} /></label>
          </div>
        </div>
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
          <button className="btn danger small" style={{ marginTop: 8 }} onClick={onReset}>Reload demo property data</button>
        </div>
      </div>
      <div className="panel" style={{ marginTop: 12 }}>
        <h3>Integrations (API layer)</h3>
        <table>
          <tbody>
            {INTEGRATIONS.map((i) => (
              <tr key={i.name}><td>{i.name}</td><td className="muted">{i.note}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="panel" style={{ marginTop: 12 }}>
        <h3>Document storage</h3>
        <p className="muted">
          Guest ID, hall contracts and payment proofs are saved on this computer (browser IndexedDB). View in the software,
          Save copy to Downloads, or re-upload if you open Gayatri on another PC. PDF or image, 8 MB per file.
        </p>
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
  );
}
