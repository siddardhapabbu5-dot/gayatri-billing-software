import { useCallback, useEffect, useState } from "react";
import { createStaffUser, listStaffUsers } from "../api/client";

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
        Owner and manager can create staff accounts. Staff see bookings, guests, rooms, payments, documents and
        expense entry — not venues master, vendors, reports or settings.
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
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.name}</td>
              <td className="muted">{u.email}</td>
              <td>{u.roleLabel || u.role}</td>
            </tr>
          ))}
          {!loading && !users.length ? (
            <tr>
              <td colSpan={3} className="muted">
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
            onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
          />
        </label>
        <label>
          Email
          <input
            type="email"
            required
            autoComplete="off"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
        </label>
        <label>
          Temporary password
          <input
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          />
        </label>
        <label>
          Role
          <select
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
          >
            {roleOptions.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <div style={{ gridColumn: "1 / -1" }}>
          <button className="btn" type="submit" disabled={busy}>
            {busy ? "Creating…" : "Create account"}
          </button>
        </div>
      </form>
    </div>
  );
}
