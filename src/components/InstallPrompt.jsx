import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (isStandaloneApp() || dismissed) return undefined;

    const stopCapture = initPwaInstallCapture();
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
      stopCapture();
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
    const result = await promptPwaInstall();
    if (result.ok || result.reason === "dismissed" || result.reason === "accepted") {
      dismiss();
    }
  }

  const apple = isAppleTouchDevice();

  return (
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
        {deferred && (
          <button type="button" className="btn pwa-install-btn" onClick={install}>
            Install
          </button>
        )}
        <button type="button" className="btn ghost pwa-install-dismiss" onClick={dismiss}>
          Not now
        </button>
      </div>
    </div>
  );
}
