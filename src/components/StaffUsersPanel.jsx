import { useCallback, useEffect, useState } from "react";
import { createStaffUser, listStaffUsers, updateStaffUser } from "../api/client";

const CREATE_ROLES = [
  { value: "FRONTDESK", label: "Staff (desk)" },
  { value: "HOUSEKEEPING", label: "Housekeeping" },
  { value: "ACCOUNTS", label: "Accounts" },
  { value: "MANAGER", label: "Property manager" },
  { value: "ADMIN", label: "Owner administrator" },
];

export default function StaffUsersPanel({ canManage, authRole }) {
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

  const roleOptions =
    authRole === "admin" ? CREATE_ROLES : CREATE_ROLES.filter((r) => r.value !== "ADMIN");

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
        <h3>Users & roles</h3>
        <p className="muted">Only the owner or property manager can view and create staff accounts.</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <h3>Users & roles</h3>
      <p className="muted" style={{ marginBottom: 10 }}>
        Create, deactivate, change role, or reset password. The last active Owner cannot be deactivated or demoted.
        Every change is audited on the server.
      </p>

      {loading ? <p className="muted">Loading accounts…</p> : null}
      {error ? <p className="staff-login-error" style={{ marginBottom: 8 }}>{error}</p> : null}
      {note ? <p className="muted" style={{ marginBottom: 8 }}>{note}</p> : null}

      <table>
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
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.name}</td>
              <td className="muted">{u.email}</td>
              <td>
                <select
                  value={String(u.role || "").toUpperCase()}
                  disabled={busy}
                  onChange={(e) => patchUser(u, { role: e.target.value })}
                >
                  {roleOptions.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </td>
              <td>{u.active ? "Active" : "Inactive"}</td>
              <td className="row" style={{ gap: 6, flexWrap: "wrap" }}>
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
              </td>
            </tr>
          ))}
          {!loading && !users.length ? (
            <tr>
              <td colSpan={5} className="muted">
                No API users yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <h3 style={{ marginTop: 16 }}>Create staff account</h3>
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
  );
}
