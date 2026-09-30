import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import PwaInstallHost from "./components/PwaInstallHost.jsx";
import { isStaffPath, syncAppModeFromUrl } from "./lib/appMode.js";
import { initPwaInstallCapture } from "./lib/pwaInstall.js";
import "./index.css";
import "./staff-mobile.css";

const previewPath = String(window.location.pathname || "").replace(/\/+$/, "") || "/";
const isMobilePreview = previewPath === "/app-preview" || previewPath.startsWith("/app-preview/");
const isPwaDebug = previewPath === "/debug/pwa";

/** Phone opening /staff gets the phone app. Desktop /staff stays the live desk. ?desk=1 keeps the desk on a phone. */
function isPhoneVisitor() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("desk") === "1") return false;
  const ua = navigator.userAgent || "";
  if (/iPhone|iPod|Android.+Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return true;
  return window.matchMedia("(max-width: 767px)").matches;
}

const openPhoneApp = isMobilePreview || (isStaffPath() && isPhoneVisitor());

syncAppModeFromUrl();
initPwaInstallCapture();

const root = ReactDOM.createRoot(document.getElementById("root"));

if (isPwaDebug) {
  import("./pages/PwaDebugPage.jsx").then(({ default: PwaDebugPage }) => {
    root.render(
      <React.StrictMode>
        <PwaDebugPage />
      </React.StrictMode>
    );
  });
} else if (openPhoneApp) {
  import("./mobile-preview/MobilePreviewApp.jsx").then(({ default: MobilePreviewApp }) => {
    root.render(
      <React.StrictMode>
        <MobilePreviewApp />
      </React.StrictMode>
    );
  });
} else {
  root.render(
    <React.StrictMode>
      <App />
      <PwaInstallHost />
    </React.StrictMode>
  );
}
