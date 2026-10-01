import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { applyManifestForMode, getAppMode, isStaffAppMode, MODE_STAFF, subscribeAppMode } from "../lib/appMode.js";
import { browserName, chromeLaunchUrl, detectBrowser, inAppInstallSteps, isInAppBrowser } from "../lib/detectBrowser.js";
import {
  apkIsAvailable,
  closePwaInstallDialog,
  initPwaInstallCapture,
  installPWA,
  isAppleTouchDevice,
  isStandaloneApp,
  openPwaInstallDialog,
  subscribePwaDialog,
} from "../lib/pwaInstall.js";

const APK_HREF = "/downloads/staff-app.apk";
let autoScheduled = false;

function installTargetUrl() {
  const origin = window.location.origin;
  if (isStaffAppMode()) return `${origin}/staff?mode=staff`;
  return `${origin}/?mode=public#home`;
}

export default function PwaInstallHost() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState("");
  const [staffMode, setStaffMode] = useState(() => (typeof window === "undefined" ? false : isStaffAppMode()));
  const browser = typeof navigator === "undefined" ? detectBrowser("") : detectBrowser();
  const inApp = isInAppBrowser(browser);

  useEffect(() => {
    if (isStandaloneApp()) return undefined;
    initPwaInstallCapture();
    applyManifestForMode(getAppMode());
    const unsubDialog = subscribePwaDialog(setOpen);
    const unsubMode = subscribeAppMode((mode) => {
      setStaffMode(mode === MODE_STAFF);
      applyManifestForMode(mode);
    });

    if (!autoScheduled) {
      autoScheduled = true;
      const detected = detectBrowser();
      if (isInAppBrowser(detected)) {
        let seen = false;
        try {
          seen = sessionStorage.getItem("gayatri-inapp-install") === "1";
          sessionStorage.setItem("gayatri-inapp-install", "1");
        } catch {
          seen = false;
        }
        if (!seen) openPwaInstallDialog();
      }
    }

    return () => {
      unsubDialog();
      unsubMode();
    };
  }, []);

  if (!open || isStandaloneApp()) return null;

  const steps = inApp
    ? inAppInstallSteps(browser)
    : isAppleTouchDevice()
      ? ["Open in Safari", "Tap Share", "Tap Add to Home Screen"]
      : [
          staffMode ? "Stay in Chrome on /staff" : "Stay in Chrome on this website",
          "Tap menu ⋮ (top or bottom)",
          "Choose Install app or Add to Home screen",
        ];

  async function onInstall() {
    setBusy(true);
    setHint("");
    try {
      applyManifestForMode(getAppMode());
      const result = await installPWA();
      if (result.ok) {
        closePwaInstallDialog();
        return;
      }
      if (result.reason === "dismissed") {
        closePwaInstallDialog();
        return;
      }
      setHint(
        inApp
          ? `${browserName(browser)} cannot show the Chrome install popup. Use Open in Chrome, then Install App.`
          : "Chrome did not show the install dialog yet. Use the steps below, or wait a few seconds and tap Install App again."
      );
    } finally {
      setBusy(false);
    }
  }

  function onOpenChrome() {
    window.location.assign(chromeLaunchUrl(installTargetUrl()));
  }

  async function onApkClick(event) {
    const ready = await apkIsAvailable();
    if (ready) return;
    event.preventDefault();
    setHint("The APK is not published on this server yet. Use Open in Chrome, then Install App. That installs the same staff app.");
  }

  return createPortal(
    <div
      className="install-app-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Install Staff App"
      onClick={(event) => {
        if (event.target === event.currentTarget) closePwaInstallDialog();
      }}
    >
      <div className="install-app-sheet">
        <h2>Install Staff App</h2>
        <p>For best experience install the app.</p>
        {hint ? <p className="install-app-hint">{hint}</p> : inApp ? <p className="install-app-hint">Open in Chrome to Install App</p> : null}
        <div className="install-app-actions">
          {inApp ? (
            <button type="button" className="btn pwa-install-btn" onClick={onOpenChrome}>
              Open in Chrome to Install App
            </button>
          ) : (
            <button type="button" className="btn pwa-install-btn" disabled={busy} onClick={onInstall}>
              {busy ? "Opening…" : "Install App"}
            </button>
          )}
          <a className="btn ghost" href={APK_HREF} download onClick={onApkClick}>
            Download APK
          </a>
          {inApp ? null : (
            <button type="button" className="btn ghost" onClick={onOpenChrome}>
              Open In Chrome
            </button>
          )}
        </div>
        <p className="install-app-kicker">{inApp ? `${browserName(browser)} guide` : "Install guide"}</p>
        <ol className="install-app-steps">
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
          {inApp && browser.isIOS ? <li>On iPhone, then tap Share and Add to Home Screen.</li> : null}
        </ol>
        {staffMode ? (
          <a className="btn ghost install-app-close" href="/staff">
            Open Staff login instead
          </a>
        ) : null}
        <button type="button" className="btn ghost install-app-close" onClick={() => closePwaInstallDialog()}>
          Close
        </button>
      </div>
    </div>,
    document.body
  );
}
