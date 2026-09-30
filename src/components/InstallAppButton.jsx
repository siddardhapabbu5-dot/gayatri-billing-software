import { useEffect, useState } from "react";
import { applyManifestForMode, getAppMode, isStaffAppMode, MODE_STAFF, subscribeAppMode } from "../lib/appMode.js";
import { isInAppBrowser } from "../lib/detectBrowser.js";
import {
  getDeferredInstallPrompt,
  initPwaInstallCapture,
  isStandaloneApp,
  openPwaInstallDialog,
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

/**
 * Header control for the install sheet.
 * Chrome uses beforeinstallprompt. In-app browsers open the Chrome guide.
 */
export default function InstallAppButton({ className = "", tone = "light" }) {
  const [canPrompt, setCanPrompt] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [staffMode, setStaffMode] = useState(() => isStaffAppMode());

  useEffect(() => {
    setStandalone(isStandaloneApp());
    applyManifestForMode(getAppMode());
    initPwaInstallCapture();
    const unsubPrompt = subscribeInstallPrompt((prompt) => setCanPrompt(Boolean(prompt)));
    const unsubMode = subscribeAppMode((mode) => {
      setStaffMode(mode === MODE_STAFF);
      applyManifestForMode(mode);
    });
    setCanPrompt(Boolean(getDeferredInstallPrompt()));

    try {
      if (sessionStorage.getItem(OPEN_INSTALL_KEY) === "1") {
        sessionStorage.removeItem(OPEN_INSTALL_KEY);
        window.setTimeout(() => {
          void promptPwaInstall().then((result) => {
            if (!result.ok) openPwaInstallDialog();
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

  function ensureInstallUrl() {
    if (isInAppBrowser()) return false;
    if (staffMode && !hasStaffModeQuery()) {
      try {
        sessionStorage.setItem(OPEN_INSTALL_KEY, "1");
      } catch {
        /* ignore */
      }
      window.location.assign("/staff?mode=staff");
      return true;
    }
    return false;
  }

  async function onInstallClick() {
    if (ensureInstallUrl()) return;
    if (isInAppBrowser() || !getDeferredInstallPrompt()) {
      openPwaInstallDialog();
      return;
    }
    const native = await promptPwaInstall();
    if (native.ok || native.reason === "dismissed") return;
    openPwaInstallDialog();
  }

  return (
    <button
      type="button"
      className={`install-app-btn install-app-btn--${tone}${className ? ` ${className}` : ""}`}
      onClick={onInstallClick}
      aria-haspopup="dialog"
    >
      {canPrompt ? "Install app" : "Get app"}
    </button>
  );
}
