import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  applyManifestForMode,
  getAppMode,
  isStaffAppMode,
  MODE_STAFF,
  subscribeAppMode,
} from "../lib/appMode.js";
import {
  getDeferredInstallPrompt,
  initPwaInstallCapture,
  isAppleTouchDevice,
  isStandaloneApp,
  promptPwaInstall,
  subscribeInstallPrompt,
} from "../lib/pwaInstall.js";

/**
 * “Get app” — installs Public or Staff PWA depending on current app mode.
 */
export default function InstallAppButton({ className = "", tone = "light" }) {
  const [open, setOpen] = useState(false);
  const [canPrompt, setCanPrompt] = useState(false);
  const [busy, setBusy] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [hint, setHint] = useState("");
  const [staffMode, setStaffMode] = useState(() => isStaffAppMode());

  useEffect(() => {
    setStandalone(isStandaloneApp());
    applyManifestForMode(getAppMode());
    initPwaInstallCapture();
    const unsubPrompt = subscribeInstallPrompt((p) => setCanPrompt(Boolean(p)));
    const unsubMode = subscribeAppMode((mode) => {
      setStaffMode(mode === MODE_STAFF);
      applyManifestForMode(mode);
    });
    setCanPrompt(Boolean(getDeferredInstallPrompt()));
    return () => {
      unsubPrompt();
      unsubMode();
    };
  }, []);

  if (standalone) return null;

  const apple = isAppleTouchDevice();
  const appLabel = staffMode ? "Gayatri Staff" : "Gayatri";

  async function tryNativeInstall() {
    applyManifestForMode(getAppMode());
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
              <h2>{staffMode ? "Install Staff app" : "Install public website app"}</h2>
              <p>
                {staffMode
                  ? "Install Gayatri Staff on this device — website pages plus Staff desk entry. Same layout on phone, tablet, and desktop."
                  : "Install the public Gayatri website on this device — Home through Terms (no Staff). Same layout on phone, tablet, and desktop."}{" "}
                This adds <strong>{appLabel}</strong> as a home-screen / desktop app (not an App Store download).
              </p>
              {hint ? <p className="install-app-hint">{hint}</p> : null}
              {canPrompt ? (
                <button
                  type="button"
                  className="btn pwa-install-btn"
                  disabled={busy}
                  onClick={onInstallClick}
                >
                  {busy ? "Opening…" : `Install ${appLabel}`}
                </button>
              ) : apple ? (
                <ol className="install-app-steps">
                  <li>
                    Open this page in <strong>Safari</strong>
                    {staffMode ? (
                      <>
                        {" "}
                        (use <code>?mode=staff</code> for Staff app)
                      </>
                    ) : null}
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
                    {staffMode ? (
                      <>
                        {" "}
                        at <code>/?mode=staff</code>
                      </>
                    ) : (
                      <>
                        {" "}
                        at <code>/?mode=public</code>
                      </>
                    )}
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
