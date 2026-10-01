import { useEffect, useState } from "react";
import { fetchServerStatus, readDiag } from "../api/client";

function line(label, value) {
  return (
    <p>
      <strong>{label}</strong> {value || "—"}
    </p>
  );
}

export default function ServerStatus({ lastSync = "", compact = false }) {
  const [row, setRow] = useState(null);
  const [diag, setDiag] = useState({});

  useEffect(() => {
    let stop = false;
    async function pull() {
      const next = await fetchServerStatus();
      if (stop) return;
      setRow(next);
      setDiag(readDiag());
    }
    pull();
    const timer = setInterval(pull, 5000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, []);

  const Tag = compact ? "article" : "section";
  return (
    <Tag className={compact ? "mapp-card" : "panel"}>
      <h3>Server and sync</h3>
      {!row ? <p>Checking the server…</p> : null}
      {row ? (
        <>
          {line("Server", row.server === "online" ? "online" : row.reason || "Cannot connect to server")}
          {line("Database", row.database)}
          {line("Authentication", row.authentication)}
          {line("Sync", row.sync)}
          {line("Health time", row.timestamp)}
          {line("Last phone or desk read", lastSync)}
          {line("Last API call", diag.lastApi ? `${diag.lastApi} · ${diag.lastApiResult}` : "")}
          {line("Last login", diag.lastLogin ? `${diag.lastLogin} · ${diag.lastLoginResult} · ${diag.lastLoginAt || ""}` : "")}
        </>
      ) : null}
      <p>
        The desk and the phone both call https://gayatriconvention.com/api. Closing the office computer does not stop the phone.
      </p>
    </Tag>
  );
}
