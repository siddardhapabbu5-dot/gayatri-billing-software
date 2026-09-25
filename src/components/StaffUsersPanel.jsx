import { useCallback, useEffect, useState } from "react";
import { createStaffUser, listStaffUsers, updateStaffUser } from "../api/client";

const ROLE_LABEL = {
  ADMIN: "Owner",
  MANAGER: "Manager",
  FRONTDESK: "Staff / Front Desk",
  STAFF: "Staff / Front Desk",
  ACCOUNTS: "Accounts",
  HOUSEKEEPING: "Housekeeping",
};

const CREATE_ROLES_OWNER = [
  { value: "FRONTDESK", label: "Staff / Front Desk" },
  { value: "MANAGER", label: "Manager" },
  { value: "ACCOUNTS", label: "Accounts" },
  { value: "HOUSEKEEPING", label: "Housekeeping" },
];

const CREATE_ROLES_MANAGER = [{ value: "FRONTDESK", label: "Staff / Front Desk" }];

function roleName(role) {
  const key = String(role || "").toUpperCase();
  return ROLE_LABEL[key] || key || "—";
}

export default function StaffUsersPanel({ canManage, authRole, standalone = false }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    role: "FRONTDESK",
  });

  const isOwner = authRole === "admin";
  const roleOptions = isOwner ? CREATE_ROLES_OWNER : CREATE_ROLES_MANAGER;

  function canEditRow(u) {
    const role = String(u.role || "").toUpperCase();
    if (isOwner) return true;
    return role === "FRONTDESK" || role === "STAFF";
  }

  const load = useCallback(async () => {
    if (!canManage) return;
    setLoading(true);
    setError("");
    try {
      setUsers(await listStaffUsers());
    } catch (err) {
      setError(err.message || "Could not load users");
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    load();
  }, [load]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNote("");
    try {
      await createStaffUser({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
      });
      setForm({ fullName: "", email: "", password: "", role: "FRONTDESK" });
      setNote("Account created. They can sign in on the staff desk with this email and password.");
      await load();
    } catch (err) {
      setError(err.message || "Could not create user");
    } finally {
      setBusy(false);
    }
  }

  async function patchUser(u, patch) {
    setBusy(true);
    setError("");
    setNote("");
    try {
      await updateStaffUser(u.serverId, patch);
      setNote("Account updated.");
      await load();
    } catch (err) {
      setError(err.message || "Update failed");
    } finally {
      setBusy(false);
    }
  }

  if (!canManage) {
    return (
      <div className="panel">
        <h3>User Management</h3>
        <p className="muted">Only the Owner or Manager can open this page.</p>
      </div>
    );
  }

  return (
    <div className={`users-mgmt${standalone ? " users-mgmt-standalone" : ""}`}>
      <div className="panel">
        <h3>Staff accounts</h3>
        <p className="muted" style={{ marginBottom: 10 }}>
          {isOwner
            ? "Create Manager or Staff accounts, change roles, deactivate, or reset passwords. The last active Owner cannot be deactivated or demoted."
            : "Managers may create and manage Front Desk Staff only. Owner and Manager accounts are Owner-controlled."}
        </p>

        {loading ? <p className="muted">Loading accounts…</p> : null}
        {error ? <p className="staff-login-error" style={{ marginBottom: 8 }}>{error}</p> : null}
        {note ? <p className="pill ok" style={{ marginBottom: 8 }}>{note}</p> : null}

        <div className="table-wrap">
          <table className="users-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const roleKey = String(u.role || "").toUpperCase();
                return (
                  <tr key={u.id} className={u.active ? undefined : "muted"}>
                    <td>{u.name}</td>
                    <td className="muted">{u.email}</td>
                    <td>
                      {canEditRow(u) ? (
                        <select
                          value={roleKey === "STAFF" ? "FRONTDESK" : roleKey}
                          disabled={busy}
                          onChange={(e) => patchUser(u, { role: e.target.value })}
                          aria-label={`Role for ${u.name}`}
                        >
                          {roleOptions.map((r) => (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          ))}
                          {isOwner && roleKey === "ADMIN" ? (
                            <option value="ADMIN">Owner</option>
                          ) : null}
                        </select>
                      ) : (
                        <strong>{roleName(u.role)}</strong>
                      )}
                    </td>
                    <td>
                      <span className={`user-status${u.active ? " is-active" : " is-inactive"}`}>
                        {u.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                      {canEditRow(u) ? (
                        <>
                          <button
                            type="button"
                            className="btn ghost small"
                            disabled={busy}
                            onClick={() => patchUser(u, { active: !u.active })}
                          >
                            {u.active ? "Deactivate" : "Activate"}
                          </button>
                          <button
                            type="button"
                            className="btn ghost small"
                            disabled={busy}
                            onClick={() => {
                              const pw = window.prompt("New password (min 8 characters)");
                              if (pw) patchUser(u, { newPassword: pw });
                            }}
                          >
                            Reset password
                          </button>
                        </>
                      ) : (
                        <span className="muted">Owner only</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!loading && !users.length ? (
                <tr>
                  <td colSpan={5} className="muted">
                    No staff accounts yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 12 }}>
        <h3>Create account</h3>
        <form className="fields two" onSubmit={submit} style={{ marginTop: 8 }}>
          <label>
            Full name
            <input
              required
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            />
          </label>
          <label>
            Email
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>
          <label>
            Temporary password
            <input
              required
              type="password"
              minLength={8}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </label>
          <label>
            Role
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {roleOptions.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn" disabled={busy}>
            {busy ? "Saving…" : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}
