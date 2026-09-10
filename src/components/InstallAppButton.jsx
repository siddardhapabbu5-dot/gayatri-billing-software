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

const OPEN_INSTALL_KEY = "gayatri-open-install";

function hasStaffModeQuery() {
  try {
    return new URLSearchParams(window.location.search).get("mode") === "staff";
  } catch {
    return false;
  }
}

function hasPublicModeQuery() {
  try {
    return new URLSearchParams(window.location.search).get("mode") === "public";
  } catch {
    return false;
  }
}

/**
 * “Get app” — installs Public or Staff PWA depending on current app mode.
 * Not an APK / Play Store download — uses Chrome/Safari Add to Home Screen.
 */
export default function InstallAppButton({ className = "", tone = "light" }) {
  const [open, setOpen] = useState(false);
  const [canPrompt, setCanPrompt] = useState(false);
  const [busy, setBusy] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [hint, setHint] = useState("");
  const [staffMode, setStaffMode] = useState(() => isStaffAppMode());
  const [swReady, setSwReady] = useState(false);

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

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready
        .then(() => setSwReady(true))
        .catch(() => setSwReady(false));
    }

    try {
      if (sessionStorage.getItem(OPEN_INSTALL_KEY) === "1") {
        sessionStorage.removeItem(OPEN_INSTALL_KEY);
        setOpen(true);
        // Retry native prompt after landing on the correct mode URL.
        window.setTimeout(() => {
          void promptPwaInstall().then((r) => {
            if (r.ok) setOpen(false);
            else if (r.reason === "unavailable") {
              setHint(
                "Chrome did not show the install dialog yet. Use the steps below (⋮ → Install app), or wait a few seconds and tap Try install again."
              );
            }
          });
        }, 600);
      }
    } catch {
      /* ignore */
    }

    return () => {
      unsubPrompt();
      unsubMode();
    };
  }, []);

  if (standalone) return null;

  const apple = isAppleTouchDevice();
  const appLabel = staffMode ? "Gayatri Staff" : "Gayatri";

  function ensureInstallUrl() {
    // #staff on the public site flips staff mode, but Chrome needs ?mode=staff
    // (and the staff manifest) on the URL for a reliable install prompt.
    if (staffMode && !hasStaffModeQuery()) {
      try {
        sessionStorage.setItem(OPEN_INSTALL_KEY, "1");
      } catch {
        /* ignore */
      }
      const url = `${window.location.pathname}?mode=staff#home`;
      window.location.assign(url);
      return true;
    }
    if (!staffMode && !hasPublicModeQuery() && hasStaffModeQuery()) {
      // unlikely path
    }
    return false;
  }

  async function tryNativeInstall() {
    applyManifestForMode(getAppMode());
    setBusy(true);
    try {
      if (!getDeferredInstallPrompt()) return { ok: false, reason: "unavailable" };
      return await promptPwaInstall();
    } finally {
      setBusy(false);
    }
  }

  async function onInstallClick() {
    setHint("");
    if (ensureInstallUrl()) return;

    const native = await tryNativeInstall();
    if (native.ok) {
      setOpen(false);
      return;
    }
    if (native.reason === "dismissed") {
      setOpen(false);
      setHint("");
      return;
    }
    setOpen(true);
    if (native.reason === "failed") {
      setHint("Browser install dialog did not open. Use the steps below.");
    } else if (native.reason === "unavailable") {
      setHint(
        "This is not an App Store / Play Store download. Add Gayatri to your home screen with the steps below."
      );
    }
  }

  const modal =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            className="install-app-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Install app"
            onClick={(e) => {
              if (e.target === e.currentTarget) setOpen(false);
            }}
          >
            <div className="install-app-sheet">
              <h2>{staffMode ? "Install Staff app" : "Install public website app"}</h2>
              <p>
                {staffMode
                  ? "Adds Gayatri Staff to your home screen — website plus Staff desk."
                  : "Adds the Gayatri website to your home screen (Home → Terms)."}{" "}
                <strong>Not a Play Store / App Store download.</strong>
              </p>
              {hint ? <p className="install-app-hint">{hint}</p> : null}
              {!swReady ? (
                <p className="install-app-hint">Preparing app files… wait a moment, then try again.</p>
              ) : null}

              <button
                type="button"
                className="btn pwa-install-btn"
                disabled={busy}
                onClick={onInstallClick}
              >
                {busy ? "Opening…" : canPrompt ? `Install ${appLabel}` : "Try install again"}
              </button>

              {apple ? (
                <ol className="install-app-steps">
                  <li>
                    Open in <strong>Safari</strong>
                    {staffMode ? (
                      <>
                        {" "}
                        at <code>/?mode=staff</code>
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
                    Stay in <strong>Chrome</strong>
                    {staffMode ? (
                      <>
                        {" "}
                        on <code>/?mode=staff</code>
                      </>
                    ) : (
                      <>
                        {" "}
                        on <code>/?mode=public</code>
                      </>
                    )}
                  </li>
                  <li>
                    Tap menu <strong>⋮</strong> (top or bottom)
                  </li>
                  <li>
                    Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>
                  </li>
                </ol>
              )}

              {staffMode ? (
                <a className="btn ghost install-app-close" href="/?mode=staff#staff/desk">
                  Open Staff login instead
                </a>
              ) : null}

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
