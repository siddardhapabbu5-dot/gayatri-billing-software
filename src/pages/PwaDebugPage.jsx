import { useEffect, useState } from "react";
import { applyManifestForMode, getAppMode } from "../lib/appMode.js";
import { browserName, detectBrowser, isInAppBrowser } from "../lib/detectBrowser.js";
import { apkIsAvailable, didBeforeInstallPromptFire, initPwaInstallCapture, isStandaloneApp } from "../lib/pwaInstall.js";

function Row({ label, ok, detail }) {
  return (
    <li className={ok ? "is-ok" : "is-no"}>
      <strong>{ok ? "Yes" : "No"}</strong>
      <span>{label}</span>
      {detail ? <em>{detail}</em> : null}
    </li>
  );
}

export default function PwaDebugPage() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    initPwaInstallCapture();
    applyManifestForMode(getAppMode());
    let cancelled = false;

    async function load() {
      const browser = detectBrowser();
      const manifestLink = document.querySelector('link[rel="manifest"]')?.getAttribute("href") || "";
      let manifest = null;
      let manifestError = "";
      if (manifestLink) {
        try {
          const res = await fetch(manifestLink);
          if (!res.ok) manifestError = `HTTP ${res.status}`;
          else manifest = await res.json();
        } catch (err) {
          manifestError = err?.message || "Could not read manifest";
        }
      } else {
        manifestError = "No manifest link";
      }

      let swScript = "";
      let swRegistered = false;
      if ("serviceWorker" in navigator) {
        try {
          const reg = await navigator.serviceWorker.getRegistration();
          swRegistered = Boolean(reg);
          swScript = reg?.active?.scriptURL || reg?.installing?.scriptURL || reg?.waiting?.scriptURL || "";
        } catch {
          swRegistered = false;
        }
      }

      const apk = await apkIsAvailable();
      if (cancelled) return;
      setStatus({
        browser,
        manifestLink,
        manifest,
        manifestError,
        swRegistered,
        swScript,
        apk,
        https: window.isSecureContext,
        prompt: didBeforeInstallPromptFire(),
        standalone: isStandaloneApp(),
      });
    }

    load();
    const timer = window.setInterval(load, 1500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const browser = status?.browser || detectBrowser();

  return (
    <main className="pwa-debug">
      <h1>PWA status</h1>
      <p>Gayatri install check. Service worker file is the one registered by the site build.</p>
      {!status ? <p>Checking…</p> : (
        <ul>
          <Row label="Manifest Loaded" ok={Boolean(status.manifest)} detail={status.manifestError || status.manifestLink} />
          <Row label="Service Worker Registered" ok={status.swRegistered} detail={status.swScript || "Not registered in this browser yet"} />
          <Row label="HTTPS Enabled" ok={status.https} detail={status.https ? "Secure context" : window.location.protocol} />
          <Row label="beforeinstallprompt Fired" ok={status.prompt} detail={status.prompt ? "Captured" : "Waiting for Chrome"} />
          <Row label="Standalone Mode" ok={status.standalone} detail={status.standalone ? "Installed" : "Browser tab"} />
          <Row label="Browser Name" ok={!isInAppBrowser(browser)} detail={browserName(browser)} />
          <Row label="APK file" ok={status.apk} detail="/downloads/staff-app.apk" />
        </ul>
      )}
      {status?.manifest ? (
        <pre>{JSON.stringify({
          name: status.manifest.name,
          short_name: status.manifest.short_name,
          display: status.manifest.display,
          start_url: status.manifest.start_url,
          background_color: status.manifest.background_color,
          theme_color: status.manifest.theme_color,
        }, null, 2)}</pre>
      ) : null}
    </main>
  );
}
