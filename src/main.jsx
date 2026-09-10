import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { syncAppModeFromUrl } from "./lib/appMode.js";
import "./index.css";
import "./staff-mobile.css";

syncAppModeFromUrl();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
