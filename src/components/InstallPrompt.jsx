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

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem("gayatri-pwa-dismiss") === "1";
    } catch {
      return false;
    }
  });
  const [showManual, setShowManual] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isStandaloneApp() || dismissed) return undefined;

    initPwaInstallCapture();
    const unsub = subscribeInstallPrompt((p) => {
      setDeferred(p);
      if (p) setShowManual(false);
    });
    setDeferred(getDeferredInstallPrompt());

    let timer = 0;
    if (isAppleTouchDevice()) {
      setShowManual(true);
    } else {
      timer = window.setTimeout(() => {
        if (!getDeferredInstallPrompt()) setShowManual(true);
      }, 2500);
    }

    return () => {
      if (timer) window.clearTimeout(timer);
      unsub();
    };
  }, [dismissed]);

  if (isStandaloneApp() || dismissed) return null;
  if (!deferred && !showManual) return null;

  function dismiss() {
    try {
      localStorage.setItem("gayatri-pwa-dismiss", "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
    setShowManual(false);
  }

  async function install() {
    setBusy(true);
    try {
      const result = await promptPwaInstall();
      if (result.ok || result.reason === "accepted") {
        dismiss();
        return;
      }
      // No native dialog — keep banner open so Share / Chrome menu steps stay visible.
      setShowManual(true);
    } finally {
      setBusy(false);
    }
  }

  const apple = isAppleTouchDevice();

  const banner = (
    <div className="pwa-install" role="dialog" aria-label="Install Gayatri app">
      <div className="pwa-install-copy">
        <strong>Install Gayatri on this tablet</strong>
        {deferred ? (
          <p>Public website + Staff desk as one app icon.</p>
        ) : apple ? (
          <p>
            Safari → Share <span aria-hidden="true">□↑</span> → <em>Add to Home Screen</em>
          </p>
        ) : (
          <p>
            Chrome menu <span aria-hidden="true">⋮</span> → <em>Install app</em> or{" "}
            <em>Add to Home screen</em>
          </p>
        )}
      </div>
      <div className="pwa-install-actions">
        {deferred ? (
          <button type="button" className="btn pwa-install-btn" disabled={busy} onClick={install}>
            {busy ? "Opening…" : "Install"}
          </button>
        ) : null}
        <button type="button" className="btn ghost pwa-install-dismiss" onClick={dismiss}>
          Not now
        </button>
      </div>
    </div>
  );

  if (typeof document === "undefined") return banner;
  return createPortal(banner, document.body);
}
