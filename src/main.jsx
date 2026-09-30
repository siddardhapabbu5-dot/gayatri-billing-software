import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import PwaInstallHost from "./components/PwaInstallHost.jsx";
import { syncAppModeFromUrl } from "./lib/appMode.js";
import { initPwaInstallCapture } from "./lib/pwaInstall.js";
import "./index.css";
import "./staff-mobile.css";

const previewPath = String(window.location.pathname || "").replace(/\/+$/, "") || "/";
const isMobilePreview = previewPath === "/app-preview" || previewPath.startsWith("/app-preview/");
const isPwaDebug = previewPath === "/debug/pwa";
const openPhoneApp = isMobilePreview;

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
