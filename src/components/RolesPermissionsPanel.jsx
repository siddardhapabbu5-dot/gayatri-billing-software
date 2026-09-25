import { useCallback, useEffect, useState } from "react";
import {
  fetchRbacAudit,
  fetchRbacMatrix,
  fetchRbacSettings,
  saveManagerRefundLimit,
  saveRolePermissions,
} from "../api/client";

const ROLE_ORDER = ["MANAGER", "FRONTDESK", "ACCOUNTS", "HOUSEKEEPING"];
const ROLE_LABEL = {
  MANAGER: "Manager",
  FRONTDESK: "Staff / Front Desk",
  ACCOUNTS: "Accounts",
  HOUSEKEEPING: "Housekeeping",
};

export default function RolesPermissionsPanel({ canEdit }) {
  const [matrix, setMatrix] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [role, setRole] = useState("FRONTDESK");
  const [draft, setDraft] = useState({});
  const [limit, setLimit] = useState("50000");
  const [audit, setAudit] = useState([]);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const [m, s, a] = await Promise.all([
        fetchRbacMatrix(),
        fetchRbacSettings(),
        fetchRbacAudit().catch(() => []),
      ]);
      setMatrix(m.roles || {});
      setCatalog(m.catalog || []);
      setDraft({ ...(m.roles?.[role] || {}) });
      setLimit(s?.settings?.["manager.refund.limit"] || "50000");
      setAudit(a || []);
    } catch (err) {
      setError(err.message || "Could not load roles");
    }
  }, [role]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (matrix?.[role]) setDraft({ ...matrix[role] });
  }, [role, matrix]);

  async function savePerms() {
    if (!canEdit) return;
    setBusy(true);
    setError("");
    setNote("");
    try {
      const next = await saveRolePermissions(role, draft);
      setMatrix(next.roles || {});
      setNote(`Saved permissions for ${ROLE_LABEL[role] || role}. Other devices pick this up on next login / sync.`);
    } catch (err) {
      setError(err.message || "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveLimit() {
    if (!canEdit) return;
    setBusy(true);
    setError("");
    try {
      await saveManagerRefundLimit(Number(limit) || 0);
      setNote("Manager refund limit updated.");
      await load();
    } catch (err) {
      setError(err.message || "Could not save limit");
    } finally {
      setBusy(false);
    }
  }

  if (!canEdit) {
    return (
      <div className="panel">
        <h3>Roles &amp; permissions</h3>
        <p className="muted">Only the Owner can edit day-to-day role permissions and the manager refund limit.</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <h3>Roles &amp; permissions</h3>
      <p className="muted" style={{ marginBottom: 10 }}>
        Changes save to PostgreSQL and apply on the API for every device. Owner creation and Owner permission keys stay
        protected.
      </p>
      {error ? <p className="staff-login-error">{error}</p> : null}
      {note ? <p className="muted">{note}</p> : null}

      <label>
        Manager refund approve limit (₹)
        <div className="row" style={{ gap: 8, marginTop: 4 }}>
          <input type="number" min="0" value={limit} onChange={(e) => setLimit(e.target.value)} style={{ maxWidth: 160 }} />
          <button type="button" className="btn small" disabled={busy} onClick={saveLimit}>
            Save limit
          </button>
        </div>
      </label>

      <label style={{ marginTop: 14, display: "block" }}>
        Role
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          {ROLE_ORDER.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
      </label>

      <div style={{ maxHeight: 320, overflow: "auto", marginTop: 10, border: "1px solid var(--line, #ddd)", borderRadius: 8, padding: 8 }}>
        {catalog.map((key) => (
          <label key={key} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={Boolean(draft[key])}
              onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.checked }))}
            />
            <code>{key}</code>
          </label>
        ))}
      </div>
      <button type="button" className="btn" style={{ marginTop: 10 }} disabled={busy} onClick={savePerms}>
        Save role permissions
      </button>

      <h3 style={{ marginTop: 20 }}>Recent audit</h3>
      <table>
        <thead>
          <tr>
            <th>When</th>
            <th>Action</th>
            <th>Detail</th>
          </tr>
        </thead>
        <tbody>
          {audit.slice(0, 20).map((row) => (
            <tr key={row.id}>
              <td className="muted">{row.createdAt ? String(row.createdAt).slice(0, 19).replace("T", " ") : "—"}</td>
              <td>{row.action}</td>
              <td className="muted">{row.detail || row.entity || "—"}</td>
            </tr>
          ))}
          {!audit.length ? (
            <tr>
              <td colSpan={3} className="muted">
                No audit entries yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
