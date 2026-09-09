import { useEffect, useRef, useState } from "react";

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

/** iPhone/iPad including iPadOS “desktop” Safari (reports as Macintosh). */
function isAppleTouchDevice() {
  const ua = window.navigator.userAgent || "";
  if (/iphone|ipod|ipad/i.test(ua)) return true;
  return /macintosh/i.test(ua) && (window.navigator.maxTouchPoints || 0) > 1;
}

function isTouchTabletOrPhone() {
  return (
    isAppleTouchDevice() ||
    (window.matchMedia("(pointer: coarse)").matches &&
      Math.min(window.screen.width, window.screen.height) >= 600) ||
    (window.navigator.maxTouchPoints || 0) > 1
  );
}

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const deferredRef = useRef(null);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem("gayatri-pwa-dismiss") === "1";
    } catch {
      return false;
    }
  });
  const [showManual, setShowManual] = useState(false);

  useEffect(() => {
    if (isStandalone() || dismissed) return undefined;

    const onPrompt = (e) => {
      e.preventDefault();
      deferredRef.current = e;
      setDeferred(e);
      setShowManual(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    let timer = 0;
    if (isAppleTouchDevice()) {
      setShowManual(true);
    } else if (isTouchTabletOrPhone()) {
      timer = window.setTimeout(() => {
        if (!deferredRef.current) setShowManual(true);
      }, 2500);
    }

    return () => {
      if (timer) window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onPrompt);
    };
  }, [dismissed]);

  if (isStandalone() || dismissed) return null;
  if (!deferred && !showManual) return null;

  function dismiss() {
    try {
      localStorage.setItem("gayatri-pwa-dismiss", "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
    setDeferred(null);
    deferredRef.current = null;
    setShowManual(false);
  }

  async function install() {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    deferredRef.current = null;
    dismiss();
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
