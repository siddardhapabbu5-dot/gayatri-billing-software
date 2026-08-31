import { money, statusTone } from "./lib";

export function PageHead({ title, sub, children }) {
  return (
    <div className="page-lead">
      <div>
        <h2>{title}</h2>
        {sub && <p>{sub}</p>}
      </div>
      <div className="row no-print">{children}</div>
    </div>
  );
}

export function Money({ n, currency = "INR", locale = "en-IN" }) {
  return <>{money(n, currency, locale)}</>;
}

export function Pill({ status, children }) {
  return <span className={`pill ${statusTone(status || children)}`}>{children || status}</span>;
}

export function Kpi({ k, v, s, tone }) {
  return (
    <div className={`kpi${tone ? ` tone-${tone}` : ""}`}>
      <div className="k">{k}</div>
      <div className="v">{v}</div>
      {s && <div className="s">{s}</div>}
    </div>
  );
}
