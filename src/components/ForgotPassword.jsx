import { useState } from "react";
import { requestPasswordOtp, resetForgottenPassword, verifyPasswordOtp } from "../api/client";

const RULE = "At least 8 characters, 1 uppercase letter, 1 number, and 1 special character.";

export function passwordIsStrong(value) {
  return value.length >= 8
    && /[A-Z]/.test(value)
    && /\d/.test(value)
    && /[^A-Za-z0-9]/.test(value);
}

export default function ForgotPassword({ variant = "desk", onBack }) {
  const [step, setStep] = useState("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [shownOtp, setShownOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const desk = variant === "desk";

  async function sendOtp(e) {
    e?.preventDefault();
    setError("");
    setBusy(true);
    try {
      const out = await requestPasswordOtp(phone.trim());
      setShownOtp(out.otp || "");
      setOtp("");
      setNote(out.otp
        ? `Your OTP is ${out.otp}. It expires in 5 minutes.`
        : out.message);
      setStep("otp");
    } catch (err) {
      setError(err.message || "OTP could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  async function checkOtp(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const out = await verifyPasswordOtp(phone.trim(), otp.trim());
      setResetToken(out.resetToken);
      setNote(out.message || "OTP verified. Set a new password.");
      setStep("password");
    } catch (err) {
      setError(err.message || "OTP could not be verified.");
    } finally {
      setBusy(false);
    }
  }

  async function savePassword(e) {
    e.preventDefault();
    setError("");
    if (!passwordIsStrong(password)) {
      setError(RULE);
      return;
    }
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const out = await resetForgottenPassword(resetToken, password);
      setNote(out.message || "Password updated. Sign in with your new password.");
      setPassword("");
      setConfirm("");
      setStep("done");
    } catch (err) {
      setError(err.message || "Password was not updated.");
    } finally {
      setBusy(false);
    }
  }

  const formClass = desk ? "staff-login-form" : "";
  return (
    <div className={desk ? "" : "mapp-forgot"}>
      {step === "done" ? (
        <>
          <h2>{desk ? "Password updated" : "Password updated"}</h2>
          <p className={desk ? "staff-login-ok" : "sub"}>{note}</p>
          <button type="button" className={desk ? "btn staff-login-submit" : "mapp-cta"} onClick={onBack}>
            Login
          </button>
        </>
      ) : null}

      {step === "phone" ? (
        <form className={formClass} onSubmit={sendOtp}>
          <h2 style={desk ? undefined : { marginTop: 0 }}>Forgot password</h2>
          <p className={desk ? "staff-login-sub" : "sub"}>Enter the mobile number saved on your staff account.</p>
          <label>
            Mobile number
            <input
              inputMode="tel"
              autoComplete="tel"
              required
              maxLength={14}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="10-digit mobile"
            />
          </label>
          {error ? <p className={desk ? "staff-login-error" : "sub"} role="alert">{error}</p> : null}
          <button className={desk ? "btn staff-login-submit" : "mapp-cta"} type="submit" disabled={busy}>
            {busy ? "Sending…" : "Receive OTP"}
          </button>
          <button type="button" className={desk ? "staff-login-forgot" : "mapp-textbtn"} onClick={onBack}>
            Back to sign in
          </button>
        </form>
      ) : null}

      {step === "otp" ? (
        <form className={formClass} onSubmit={checkOtp}>
          <h2 style={desk ? undefined : { marginTop: 0 }}>Verify OTP</h2>
          <p className={desk ? "staff-login-ok" : "sub"}>{note}</p>
          {shownOtp ? <p className={desk ? "staff-login-sub" : "sub"}>Enter that code below. Three wrong tries lock it.</p> : null}
          <label>
            OTP
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            />
          </label>
          {error ? <p className={desk ? "staff-login-error" : "sub"} role="alert">{error}</p> : null}
          <button className={desk ? "btn staff-login-submit" : "mapp-cta"} type="submit" disabled={busy}>
            {busy ? "Checking…" : "Verify OTP"}
          </button>
          <button type="button" className={desk ? "staff-login-forgot" : "mapp-textbtn"} disabled={busy} onClick={sendOtp}>
            Send a new OTP
          </button>
        </form>
      ) : null}

      {step === "password" ? (
        <form className={formClass} onSubmit={savePassword}>
          <h2 style={desk ? undefined : { marginTop: 0 }}>Set new password</h2>
          <p className={desk ? "staff-login-sub" : "sub"}>{RULE}</p>
          <label>
            New password
            <input type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <label>
            Confirm password
            <input type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </label>
          {error ? <p className={desk ? "staff-login-error" : "sub"} role="alert">{error}</p> : null}
          <button className={desk ? "btn staff-login-submit" : "mapp-cta"} type="submit" disabled={busy}>
            {busy ? "Saving…" : "Set new password"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
