import { useEffect, useMemo, useState } from "react";
import { healthCheck, login } from "../api/client";

const LOGIN_BG = "/site/images/staff-login-bg.jpg?v=4";

export default function StaffLogin({ onSuccess, onBack }) {
  const [email, setEmail] = useState("owner@gayatrifunctionhall.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [apiUp, setApiUp] = useState(null);

  const reduceMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );

  const sparks = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        id: i,
        left: `${4 + ((i * 17) % 92)}%`,
        delay: `${-(i * 0.55)}s`,
        duration: `${8 + (i % 6)}s`,
        size: 0.55 + (i % 5) * 0.22,
      })),
    []
  );

  useEffect(() => {
    healthCheck().then(setApiUp);
  }, []);

  useEffect(() => {
    document.documentElement.classList.add("staff-login-theme");
    return () => document.documentElement.classList.remove("staff-login-theme");
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
      const raw = err.message || "Login failed";
      if (/cors/i.test(raw)) {
        setError("Login blocked by CORS. Restart Vite + Spring Boot, then try again.");
      } else {
        setError(raw);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="staff-login">
      <div className="staff-login-stage" aria-hidden="true">
        <img className="staff-login-film is-on" src={LOGIN_BG} alt="" />
        <div className="staff-login-aurora" />
        <div className="staff-login-rays" />
        <div className="staff-login-shade" />
        {!reduceMotion && (
          <div className="staff-login-sparks">
            {sparks.map((s) => (
              <span
                key={s.id}
                style={{
                  left: s.left,
                  animationDelay: s.delay,
                  animationDuration: s.duration,
                  "--spark-size": s.size,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {onBack && (
        <button className="staff-login-back" type="button" onClick={onBack}>
          ← Home
        </button>
      )}

      <div className="staff-login-card">
        <img className="staff-login-logo" src="/site/images/logo-gold.png" alt="Gayatri" />
        <p className="staff-login-kicker">Gayatri Convention</p>
        <h1>Staff desk</h1>
        <p className="staff-login-sub">
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
          <div className="staff-login-actions">
            <button className="btn staff-login-submit" type="submit" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </div>
        </form>
        <div className="staff-login-hint">
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
