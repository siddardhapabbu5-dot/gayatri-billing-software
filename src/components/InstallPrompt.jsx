import { useEffect, useState } from "react";

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem("gayatri-pwa-dismiss") === "1";
    } catch {
      return false;
    }
  });
  const [showIos, setShowIos] = useState(false);

  useEffect(() => {
    if (isStandalone() || dismissed) return undefined;

    const onPrompt = (e) => {
      e.preventDefault();
      setDeferred(e);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    if (isIos()) setShowIos(true);

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, [dismissed]);

  if (isStandalone() || dismissed) return null;
  if (!deferred && !showIos) return null;

  function dismiss() {
    try {
      localStorage.setItem("gayatri-pwa-dismiss", "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
    setDeferred(null);
    setShowIos(false);
  }

  async function install() {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    dismiss();
  }

  return (
    <div className="pwa-install" role="dialog" aria-label="Install Gayatri app">
      <div className="pwa-install-copy">
        <strong>Install Gayatri on this phone</strong>
        {deferred ? (
          <p>Public website + Staff desk in one app icon.</p>
        ) : (
          <p>
            Tap Share <span aria-hidden="true">□↑</span> then <em>Add to Home Screen</em>.
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
