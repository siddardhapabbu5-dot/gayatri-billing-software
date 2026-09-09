import { useEffect, useState } from "react";
import {
  getDeferredInstallPrompt,
  initPwaInstallCapture,
  isAppleTouchDevice,
  isStandaloneApp,
  promptPwaInstall,
  subscribeInstallPrompt,
} from "../lib/pwaInstall.js";

/**
 * Always-visible site option: “Get app version”.
 * Opens install dialog / Chrome prompt, or shows iPad Share steps.
 */
export default function InstallAppButton({ className = "", tone = "light" }) {
  const [open, setOpen] = useState(false);
  const [canPrompt, setCanPrompt] = useState(false);
  const [busy, setBusy] = useState(false);
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    setStandalone(isStandaloneApp());
    const stopCapture = initPwaInstallCapture();
    const unsub = subscribeInstallPrompt((p) => setCanPrompt(Boolean(p)));
    setCanPrompt(Boolean(getDeferredInstallPrompt()));
    return () => {
      unsub();
      stopCapture();
    };
  }, []);

  if (standalone) return null;

  const apple = isAppleTouchDevice();

  async function onInstallClick() {
    if (canPrompt) {
      setBusy(true);
      try {
        await promptPwaInstall();
        setOpen(false);
      } finally {
        setBusy(false);
      }
      return;
    }
    setOpen(true);
  }

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

      {open && (
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
              app.
            </p>
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
                  Open in <strong>Chrome</strong>
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
        </div>
      )}
    </>
  );
}
