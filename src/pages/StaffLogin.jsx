import { useEffect, useState } from "react";
import { healthCheck, login } from "../api/client";

export default function StaffLogin({ onSuccess, onBack }) {
  const [email, setEmail] = useState("owner@gayatrifunctionhall.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [apiUp, setApiUp] = useState(null);

  useEffect(() => {
    healthCheck().then(setApiUp);
  }, []);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const up = await healthCheck();
      setApiUp(up);
      if (!up) {
        setError("Backend is not reachable on :8080. Start Postgres + Spring Boot (see backend/README.md).");
        return;
      }
      const out = await login(email.trim(), password);
      onSuccess(out.user);
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="staff-login">
      <div className="staff-login-card panel">
        <img className="staff-login-logo" src="/site/images/logo-gold.png" alt="Gayatri" />
        <h1>Staff desk</h1>
        <p className="muted staff-login-sub">
          Sign in with your Gayatri role account
          {apiUp === false ? " · API offline" : apiUp ? " · API online" : ""}
        </p>
        <form className="staff-login-form" onSubmit={submit}>
          <label>
            Email
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && <p className="staff-login-error">{error}</p>}
          <div className="row staff-login-actions">
            <button className="btn" type="submit" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
            {onBack && (
              <button className="btn ghost" type="button" onClick={onBack}>
                Public site
              </button>
            )}
          </div>
        </form>
        <div className="staff-login-hint muted">
          <div className="staff-login-hint-title">Demo accounts</div>
          <ul>
            <li>
              <span>Owner</span>
              <code>owner@gayatrifunctionhall.com</code>
              <code>Owner@123</code>
            </li>
            <li>
              <span>Manager</span>
              <code>desk@gayatrifunctionhall.com</code>
              <code>Manager@123</code>
            </li>
            <li>
              <span>Housekeeping</span>
              <code>hk@gayatrifunctionhall.com</code>
              <code>Hk@123</code>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
