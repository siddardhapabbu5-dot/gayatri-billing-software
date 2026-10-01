import { useEffect, useLayoutEffect, useState } from "react";
import { healthCheck, login } from "../api/client";
import InstallAppButton from "../components/InstallAppButton.jsx";
import ForgotPassword from "../components/ForgotPassword.jsx";

export default function StaffLogin({ onSuccess, lockToDesk = false }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [apiUp, setApiUp] = useState(null);
  const [forgot, setForgot] = useState(false);

  useLayoutEffect(() => {
    document.documentElement.classList.remove("lux-page");
    document.body.classList.remove("menu-lock");
    document.body.style.overflow = "";
  }, []);

  useEffect(() => {
    healthCheck().then(setApiUp);
    const ended = sessionStorage.getItem("gayatri-session-ended");
    if (ended) {
      sessionStorage.removeItem("gayatri-session-ended");
      setError(ended);
    }
  }, []);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const out = await login(email.trim(), password);
      setApiUp(true);
      onSuccess(out.user);
    } catch (err) {
      if (!err.status) setApiUp(false);
      setError(err.reason || err.message || "Cannot connect to server");
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
          {forgot ? (
            <ForgotPassword variant="desk" onBack={() => { setForgot(false); setError(""); }} />
          ) : (
          <>
          <p className="staff-login-sheet-kicker">Team sign in</p>
          <h2>Enter the desk</h2>
          <p className="staff-login-sub">
            Sign in with your staff account
            {apiUp === false ? " · server not answering, sign-in will retry" : ""}
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
            <button type="button" className="staff-login-forgot" onClick={() => setForgot(true)}>
              Forgot password
            </button>
            {error && <p className="staff-login-error">{error}</p>}
            <button className="btn staff-login-submit" type="submit" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
          </>
          )}
        </div>
      </section>
    </div>
  );
}
