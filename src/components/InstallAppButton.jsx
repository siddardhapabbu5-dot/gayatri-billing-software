import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  getDeferredInstallPrompt,
  initPwaInstallCapture,
  isAppleTouchDevice,
  isStandaloneApp,
  promptPwaInstall,
  subscribeInstallPrompt,
} from "../lib/pwaInstall.js";

/**
 * Always-visible site option: “Get app”.
 * Opens Chrome/Edge install dialog when available, otherwise shows Add to Home Screen steps.
 * Modal portals to document.body so it works above the staff desk shell.
 */
export default function InstallAppButton({ className = "", tone = "light" }) {
  const [open, setOpen] = useState(false);
  const [canPrompt, setCanPrompt] = useState(false);
  const [busy, setBusy] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [hint, setHint] = useState("");

  useEffect(() => {
    setStandalone(isStandaloneApp());
    initPwaInstallCapture();
    const unsub = subscribeInstallPrompt((p) => setCanPrompt(Boolean(p)));
    setCanPrompt(Boolean(getDeferredInstallPrompt()));
    return unsub;
  }, []);

  if (standalone) return null;

  const apple = isAppleTouchDevice();

  async function tryNativeInstall() {
    if (!getDeferredInstallPrompt()) return { ok: false, reason: "unavailable" };
    setBusy(true);
    try {
      return await promptPwaInstall();
    } finally {
      setBusy(false);
    }
  }

  async function onInstallClick() {
    setHint("");
    const native = await tryNativeInstall();
    if (native.ok) {
      setOpen(false);
      return;
    }
    if (native.reason === "dismissed") {
      setOpen(false);
      return;
    }
    // No browser install dialog (Safari / already used / criteria) — show clear steps.
    setOpen(true);
    if (native.reason === "failed") {
      setHint("Browser install dialog did not open. Use the steps below.");
    }
  }

  const modal =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            className="install-app-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Download app version"
            onClick={(e) => {
              if (e.target === e.currentTarget) setOpen(false);
            }}
          >
            <div className="install-app-sheet">
              <h2>Download app version</h2>
              <p>
                Install Gayatri on this tablet or phone — public site and staff desk as one home-screen
                app. This is not an App Store download; it adds this website as an app icon.
              </p>
              {hint ? <p className="install-app-hint">{hint}</p> : null}
              {canPrompt ? (
                <button
                  type="button"
                  className="btn pwa-install-btn"
                  disabled={busy}
                  onClick={onInstallClick}
                >
                  {busy ? "Opening…" : "Install app"}
                </button>
              ) : apple ? (
                <ol className="install-app-steps">
                  <li>
                    Open this site in <strong>Safari</strong>
                  </li>
                  <li>
                    Tap <strong>Share</strong> <span aria-hidden="true">□↑</span>
                  </li>
                  <li>
                    Tap <strong>Add to Home Screen</strong>
                  </li>
                </ol>
              ) : (
                <ol className="install-app-steps">
                  <li>
                    Open in <strong>Chrome</strong> (or Edge)
                  </li>
                  <li>
                    Tap menu <strong>⋮</strong>
                  </li>
                  <li>
                    Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>
                  </li>
                </ol>
              )}
              <button type="button" className="btn ghost install-app-close" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        type="button"
        className={`install-app-btn install-app-btn--${tone}${className ? ` ${className}` : ""}`}
        onClick={onInstallClick}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        Get app
      </button>
      {modal}
    </>
  );
}
