import { useEffect, useLayoutEffect, useState } from "react";
import { healthCheck, login } from "../api/client";
import InstallAppButton from "../components/InstallAppButton.jsx";

export default function StaffLogin({ onSuccess, onBack }) {
  const [email, setEmail] = useState("owner@gayatrifunctionhall.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [apiUp, setApiUp] = useState(null);
  const [showDemo, setShowDemo] = useState(false);

  useLayoutEffect(() => {
    document.documentElement.classList.remove("lux-page");
    document.body.classList.remove("menu-lock");
    document.body.style.overflow = "";
  }, []);

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
      <div className="staff-login-shade" aria-hidden="true" />

      <header className="staff-login-hero">
        <div className="staff-login-hero-actions">
          <InstallAppButton tone="light" />
        </div>
        <img src="/site/images/logo-gold.png" alt="Gayatri" />
        <p>Gayatri Convention</p>
        <h1>Staff desk</h1>
        <span>Palagummi · Konaseema</span>
      </header>

      <section className="staff-login-dock">
        <div className="staff-login-dock-inner">
          <div className="staff-login-dock-copy">
            <p className="staff-login-sheet-kicker">Team sign in</p>
            <h2>Enter the desk</h2>
            <p className="staff-login-sub">
              Use your role account
              {apiUp === false ? " · API offline" : apiUp ? " · API online" : ""}
            </p>
            <button
              type="button"
              className={`staff-login-demo-toggle${showDemo ? " is-on" : ""}`}
              onClick={() => setShowDemo((v) => !v)}
            >
              {showDemo ? "Hide demo accounts" : "Demo accounts"}
            </button>
          </div>

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
            <div className="staff-login-actions">
              <button className="btn staff-login-submit" type="submit" disabled={busy}>
                {busy ? "Signing in…" : "Sign in"}
              </button>
              {onBack && (
                <button className="btn ghost staff-login-back" type="button" onClick={onBack}>
                  Public site
                </button>
              )}
            </div>
          </form>
        </div>

        {showDemo && (
          <div className="staff-login-hint muted">
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
        )}
      </section>
    </div>
  );
}
