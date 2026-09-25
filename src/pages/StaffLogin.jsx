import { useEffect, useLayoutEffect, useState } from "react";
import { healthCheck, login } from "../api/client";
import InstallAppButton from "../components/InstallAppButton.jsx";

export default function StaffLogin({ onSuccess, onBack, lockToDesk = false }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [apiUp, setApiUp] = useState(null);

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
        setError("Backend is not reachable. Start the API or check VITE_API_BASE.");
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
      <aside className="staff-login-visual" aria-hidden="true">
        <div className="staff-login-visual-shade" />
        <div className="staff-login-brand">
          <img src="/site/images/logo-gold.png" alt="" />
          <p>Gayatri Convention</p>
          <h1>Staff desk</h1>
          <span>Palagummi · Konaseema</span>
        </div>
      </aside>

      <section className="staff-login-panel">
        <div className="staff-login-panel-top">
          <InstallAppButton tone="dark" />
        </div>

        <div className="staff-login-panel-body">
          <p className="staff-login-sheet-kicker">Team sign in</p>
          <h2>Enter the desk</h2>
          <p className="staff-login-sub">
            Sign in with your staff account
            {apiUp === false ? " · API offline" : ""}
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
            <button className="btn staff-login-submit" type="submit" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>

          {onBack && (
            <div className="staff-login-panel-foot">
              <button className="staff-login-public" type="button" onClick={onBack}>
                {lockToDesk ? "Public website" : "Public site"}
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
