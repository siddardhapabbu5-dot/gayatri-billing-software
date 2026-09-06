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
    <div className="shell" style={{ placeItems: "center", minHeight: "100vh", display: "grid" }}>
      <div className="panel" style={{ width: "min(420px, 92vw)", padding: 28 }}>
        <img src="/site/images/logo-gold.png" alt="" style={{ height: 48, marginBottom: 12 }} />
        <h1 style={{ margin: "0 0 4px", fontSize: "1.4rem" }}>Staff desk</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          Sign in with your Gayatri role account
          {apiUp === false ? " · API offline" : apiUp ? " · API online" : ""}
        </p>
        <form onSubmit={submit}>
          <label style={{ display: "block", marginBottom: 10 }}>
            Email
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: "100%" }}
            />
          </label>
          <label style={{ display: "block", marginBottom: 10 }}>
            Password
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: "100%" }}
            />
          </label>
          {error && (
            <p style={{ color: "#b42318", fontSize: 14, margin: "8px 0" }}>{error}</p>
          )}
          <div className="row" style={{ gap: 8, marginTop: 14 }}>
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
        <p className="muted" style={{ fontSize: 12, marginTop: 18, lineHeight: 1.45 }}>
          Demo: owner@… / Owner@123 · desk@… / Manager@123 · hk@… / Hk@123
        </p>
      </div>
    </div>
  );
}
