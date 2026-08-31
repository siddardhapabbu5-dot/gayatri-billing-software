import { money } from "../lib";
import { PageHead, Pill } from "../ui";

export default function Venues({ state, onHall }) {
  const cur = state.property.currency;
  const loc = state.property.locale;
  return (
    <>
      <PageHead title="Venues" sub="Capacity, amenities, setup/teardown, slot rates and minimum booking value. Weekend and seasonal rules apply at reservation time." />
      <div className="g3">
        {state.halls.map((h) => (
          <div key={h.id} className="panel">
            <div className="muted">{h.code} · {h.kind}</div>
            <h3 style={{ fontSize: 22, fontFamily: "var(--serif)" }}>{h.name}</h3>
            <table>
              <tbody>
                <tr><td>Capacity</td><td>{h.capacity.toLocaleString()} seated · {h.floating} floating</td></tr>
                <tr><td>Dining</td><td>{h.dining}</td></tr>
                <tr><td>AC / kitchen / stage</td><td>{h.ac ? "AC" : "Non-AC"} · {h.kitchen ? "Kitchen" : "No kitchen"} · {h.stage ? "Stage" : "—"}</td></tr>
                <tr><td>Parking</td><td>{h.parking} cars</td></tr>
                <tr><td>Setup / clean / buffer</td><td>{h.setupHours}h · {h.teardownHours}h · {h.bufferMinutes} min</td></tr>
                <tr><td>Hourly</td><td>{money(h.rates.hourly, cur, loc)}</td></tr>
                <tr><td>Half day</td><td>{money(h.rates.halfDay, cur, loc)}</td></tr>
                <tr><td>Full day (24h)</td><td>{money(h.rates.fullDay, cur, loc)}</td></tr>
                <tr><td>Minimum</td><td>{money(h.minValue, cur, loc)}</td></tr>
                <tr><td>Seating</td><td>{h.seating.join(", ")}</td></tr>
              </tbody>
            </table>
            <div className="row" style={{ marginTop: 8 }}>
              <Pill status={h.active ? "Available" : "Cancelled"}>{h.active ? "Sellable" : "Inactive"}</Pill>
              <button
                className="btn ghost small"
                onClick={() => {
                  const v = window.prompt("Full-day rate", h.rates.fullDay);
                  if (v != null) onHall(h.id, { rates: { ...h.rates, fullDay: Number(v) || 0 } });
                }}
              >
                Edit full-day rate
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="panel" style={{ marginTop: 12 }}>
        <h3>Packages & yield rules</h3>
        <div className="g2">
          <table>
            <thead><tr><th>Package</th><th>Includes</th><th>Price</th></tr></thead>
            <tbody>
              {state.packages.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td className="muted">{p.includes.join(" · ")}</td>
                  <td>{money(p.price, cur, loc)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <table>
            <thead><tr><th>Rule</th><th>Effect</th></tr></thead>
            <tbody>
              {state.pricingRules.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>{r.percent > 0 ? "+" : ""}{r.percent}% {r.type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
