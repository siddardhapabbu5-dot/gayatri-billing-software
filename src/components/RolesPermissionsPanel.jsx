import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchRbacAudit,
  fetchRbacMatrix,
  fetchRbacSettings,
  saveManagerRefundLimit,
  saveRolePermissions,
} from "../api/client";
import { formatDateTime } from "../lib";

const ROLE_ORDER = ["MANAGER", "FRONTDESK", "ACCOUNTS", "HOUSEKEEPING"];
const ROLE_LABEL = {
  MANAGER: "Manager",
  FRONTDESK: "Staff / Front Desk",
  ACCOUNTS: "Accounts",
  HOUSEKEEPING: "Housekeeping",
};

const PERM_META = {
  dashboard: { label: "Dashboard", desc: "Open the operations dashboard overview." },
  calendar: { label: "Calendar", desc: "View hall and room availability on the calendar." },
  venues: { label: "Venues", desc: "Browse venue list and capacity details." },
  "venues.edit": { label: "Edit venue details", desc: "Change operational venue fields." },
  "prices.edit": { label: "Edit prices", desc: "Change rates and commercial pricing (Owner)." },
  rooms: { label: "Rooms", desc: "Open the rooms board." },
  "rooms.housekeeping": { label: "Housekeeping status", desc: "Update cleaning status on assigned rooms." },
  "rooms.status": { label: "Room status", desc: "Change occupancy / room status." },
  reservations: { label: "Reservations page", desc: "Open bookings and enquiry lists." },
  "booking.create": { label: "Create booking", desc: "Create and edit party bookings." },
  "booking.cancel.request": { label: "Request cancel", desc: "Submit a booking cancellation request." },
  "booking.cancel.approve": { label: "Approve cancel", desc: "Approve or perform booking cancellation." },
  guests: { label: "Guests page", desc: "Open Guests / CRM." },
  "guests.view": { label: "View guests", desc: "Read guest profiles (limited ID details)." },
  "guests.edit": { label: "Edit guests", desc: "Create or edit guest records and ID proof." },
  documents: { label: "Documents", desc: "Upload and view KYC / contract documents." },
  billing: { label: "Payment & Invoice page", desc: "Open the billing workspace." },
  "payment.record": { label: "Record payment", desc: "Collect advances and settlements." },
  "invoice.issue": { label: "Issue invoice / receipt", desc: "Issue tax invoices and receipts." },
  "refund.request": { label: "Request refund", desc: "Raise a refund request on a booking." },
  "refund.approve": { label: "Approve refund", desc: "Approve or reject pending refunds." },
  "refund.process": { label: "Process refund", desc: "Mark an approved refund as paid." },
  expenses: { label: "Expenses page", desc: "Open expense entry." },
  "expense.create": { label: "Add expense", desc: "Record a hotel or hall expense." },
  "expense.verify": { label: "Verify expense", desc: "Verify another user’s expense (not own)." },
  vendors: { label: "Vendors", desc: "Manage vendor / PO list." },
  reports: { label: "Reports page", desc: "Open the reports workspace." },
  "reports.finance": { label: "Finance reports", desc: "View finance-focused reports only." },
  "reports.all": { label: "All reports", desc: "View the full report set." },
  "settings.property": { label: "Property settings", desc: "Edit property, terms, and booking policies." },
};

const PERM_GROUPS = [
  {
    id: "bookings",
    title: "Bookings",
    keys: ["calendar", "reservations", "booking.create", "booking.cancel.request", "booking.cancel.approve"],
  },
  {
    id: "guests",
    title: "Guests",
    keys: ["guests", "guests.view", "guests.edit", "documents"],
  },
  {
    id: "payments",
    title: "Payments & Invoices",
    keys: ["billing", "payment.record", "invoice.issue"],
  },
  {
    id: "refunds",
    title: "Refunds",
    keys: ["refund.request", "refund.approve", "refund.process"],
  },
  {
    id: "expenses",
    title: "Expenses",
    keys: ["expenses", "expense.create", "expense.verify", "vendors"],
  },
  {
    id: "rooms",
    title: "Rooms & Venues",
    keys: ["rooms", "rooms.housekeeping", "rooms.status", "venues", "venues.edit", "prices.edit"],
  },
  {
    id: "reports",
    title: "Reports",
    keys: ["dashboard", "reports", "reports.finance", "reports.all"],
  },
  {
    id: "settings",
    title: "Settings",
    keys: ["settings.property"],
  },
];

function metaFor(key) {
  return PERM_META[key] || { label: key, desc: key };
}

function actorLabel(row, usersById) {
  if (row.userId != null && usersById?.[row.userId]) return usersById[row.userId];
  if (row.userId != null) return `User #${row.userId}`;
  return "System";
}

export default function RolesPermissionsPanel({ canEdit }) {
  const [matrix, setMatrix] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [role, setRole] = useState("FRONTDESK");
  /** Per-role drafts so switching roles or a failed save never drops unsaved toggles. */
  const [drafts, setDrafts] = useState({});
  const [dirty, setDirty] = useState({});
  const [limit, setLimit] = useState("50000");
  const [limitDirty, setLimitDirty] = useState(false);
  const [audit, setAudit] = useState([]);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const loadedOnce = useRef(false);

  const draft = drafts[role] || {};

  const load = useCallback(async ({ preserveDirty = true } = {}) => {
    setError("");
    try {
      const [m, s, a] = await Promise.all([
        fetchRbacMatrix(),
        fetchRbacSettings(),
        fetchRbacAudit().catch(() => []),
      ]);
      const roles = m.roles || {};
      setMatrix(roles);
      setCatalog(m.catalog || []);
      setAudit(a || []);
      setDrafts((prev) => {
        const next = { ...prev };
        for (const r of ROLE_ORDER) {
          if (preserveDirty && dirty[r]) continue;
          next[r] = { ...(roles[r] || {}) };
        }
        return next;
      });
      if (!limitDirty) {
        setLimit(s?.settings?.["manager.refund.limit"] || "50000");
      }
      loadedOnce.current = true;
    } catch (err) {
      setError(err.message || "Could not load roles");
    }
  }, [dirty, limitDirty]);

  useEffect(() => {
    load({ preserveDirty: false });
    // Initial fetch only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const grouped = useMemo(() => {
    const known = new Set(catalog);
    return PERM_GROUPS.map((g) => ({
      ...g,
      keys: g.keys.filter((k) => known.has(k) || known.size === 0),
    })).filter((g) => g.keys.length);
  }, [catalog]);

  function toggle(key, on) {
    setDrafts((prev) => ({
      ...prev,
      [role]: { ...(prev[role] || {}), [key]: on },
    }));
    setDirty((d) => ({ ...d, [role]: true }));
    setNote("");
    setError("");
  }

  async function savePerms() {
    if (!canEdit) return;
    setBusy(true);
    setError("");
    setNote("");
    const payload = drafts[role] || {};
    try {
      // API replaces overrides for this role only — other roles are untouched.
      const next = await saveRolePermissions(role, payload);
      const roles = next.roles || {};
      setMatrix(roles);
      setDrafts((prev) => ({
        ...prev,
        [role]: { ...(roles[role] || {}) },
      }));
      setDirty((d) => ({ ...d, [role]: false }));
      setNote(`Saved permissions for ${ROLE_LABEL[role] || role}. Only this role was updated.`);
      const a = await fetchRbacAudit().catch(() => []);
      setAudit(a || []);
    } catch (err) {
      // Keep draft / dirty so the Owner can retry without losing toggles.
      setError(err.message || "Save failed — your selections are still on screen.");
    } finally {
      setBusy(false);
    }
  }

  async function saveLimit() {
    if (!canEdit) return;
    setBusy(true);
    setError("");
    setNote("");
    try {
      await saveManagerRefundLimit(Number(limit) || 0);
      setLimitDirty(false);
      setNote("Manager refund approval limit updated.");
      const a = await fetchRbacAudit().catch(() => []);
      setAudit(a || []);
    } catch (err) {
      setError(err.message || "Could not save refund limit — value kept in the field.");
    } finally {
      setBusy(false);
    }
  }

  if (!canEdit) {
    return (
      <div className="panel">
        <h3>Roles &amp; permissions</h3>
        <p className="muted">Only the Owner can open and edit role permissions.</p>
      </div>
    );
  }

  return (
    <div className="rbac-page">
      {error ? <p className="staff-login-error rbac-banner">{error}</p> : null}
      {note ? <p className="pill ok rbac-banner">{note}</p> : null}

      <div className="panel rbac-rules">
        <h3>Protected system rules</h3>
        <ul className="rbac-rules-list">
          <li>Owner permissions are fixed and never edited here.</li>
          <li>Only the Owner can create or manage Owner and Manager accounts.</li>
          <li>Managers may create and manage Front Desk Staff only — not Accounts, Housekeeping, Manager, or Owner.</li>
          <li>Account-control permissions cannot be granted through these toggles.</li>
          <li>Saving updates one selected role only; other roles keep their saved settings.</li>
        </ul>
      </div>

      <div className="panel rbac-limit">
        <h3>Manager refund approval limit</h3>
        <p className="muted" style={{ marginBottom: 10 }}>
          Separate from permission toggles. Managers may approve refunds up to this amount (₹). Larger refunds need Owner approval.
        </p>
        <div className="rbac-limit-row">
          <label>
            Limit (₹)
            <input
              type="number"
              min="0"
              value={limit}
              onChange={(e) => {
                setLimit(e.target.value);
                setLimitDirty(true);
                setNote("");
                setError("");
              }}
            />
          </label>
          <button type="button" className="btn" disabled={busy || !limitDirty} onClick={saveLimit}>
            {busy ? "Saving…" : "Save limit"}
          </button>
        </div>
      </div>

      <div className="panel rbac-matrix">
        <div className="panel-head rbac-matrix-head">
          <div>
            <h3>Day-to-day permissions</h3>
            <p className="muted" style={{ margin: "4px 0 0" }}>
              Choose a role, adjust actions, then Save. Unsaved changes stay visible if Save fails.
            </p>
          </div>
          {dirty[role] ? <span className="pill warn">Unsaved changes</span> : null}
        </div>

        <div className="rbac-role-tabs" role="tablist" aria-label="Staff role">
          {ROLE_ORDER.map((r) => (
            <button
              key={r}
              type="button"
              role="tab"
              aria-selected={role === r}
              className={`chip${role === r ? " on" : ""}`}
              onClick={() => setRole(r)}
            >
              {ROLE_LABEL[r]}
              {dirty[r] ? " ·" : ""}
            </button>
          ))}
        </div>

        <div className="rbac-groups">
          {grouped.map((g) => (
            <section key={g.id} className="rbac-group">
              <h4>{g.title}</h4>
              <ul className="rbac-perm-list">
                {g.keys.map((key) => {
                  const meta = metaFor(key);
                  const on = Boolean(draft[key]);
                  return (
                    <li key={key} className="rbac-perm-row">
                      <div className="rbac-perm-copy">
                        <strong>{meta.label}</strong>
                        <span className="muted">{meta.desc}</span>
                      </div>
                      <label className="rbac-toggle">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={(e) => toggle(key, e.target.checked)}
                          aria-label={meta.label}
                        />
                        <span className="rbac-toggle-ui" data-on={on ? "1" : "0"} aria-hidden>
                          {on ? "On" : "Off"}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          {!grouped.length && loadedOnce.current ? (
            <p className="muted">No editable permissions returned from the server.</p>
          ) : null}
        </div>

        <div className="rbac-save-bar">
          <button type="button" className="btn" disabled={busy || !dirty[role]} onClick={savePerms}>
            {busy ? "Saving…" : `Save ${ROLE_LABEL[role] || role} permissions`}
          </button>
          <button
            type="button"
            className="btn ghost"
            disabled={busy || !dirty[role] || !matrix?.[role]}
            onClick={() => {
              setDrafts((prev) => ({ ...prev, [role]: { ...(matrix[role] || {}) } }));
              setDirty((d) => ({ ...d, [role]: false }));
              setError("");
              setNote("Reverted unsaved changes for this role.");
            }}
          >
            Discard changes
          </button>
        </div>
      </div>

      <div className="panel rbac-audit">
        <h3>Audit history</h3>
        <p className="muted" style={{ marginBottom: 10 }}>
          Account and permission changes recorded on the server.
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Affected item</th>
              </tr>
            </thead>
            <tbody>
              {audit.slice(0, 40).map((row) => (
                <tr key={row.id}>
                  <td className="muted">
                    {row.createdAt ? formatDateTime(row.createdAt) : "—"}
                  </td>
                  <td>{actorLabel(row)}</td>
                  <td>{row.action}</td>
                  <td className="muted">{[row.entity, row.detail].filter(Boolean).join(" · ") || "—"}</td>
                </tr>
              ))}
              {!audit.length ? (
                <tr>
                  <td colSpan={4} className="muted">
                    No audit entries yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
