import { capacityText, money } from "../lib";
import { PageHead, Pill } from "../ui";

export default function Venues({ state, onHall }) {
  const cur = state.property.currency;
  const loc = state.property.locale;
  return (
    <>
      <PageHead title="Venues" sub="Capacity, amenities, setup/teardown and slot rates. Weekend and seasonal rules apply at reservation time." />
      <div className="g3">
        {state.halls.map((h) => (
          <div key={h.id} className="panel">
            <div className="muted">{h.code} · {h.kind}</div>
            <h3 style={{ fontSize: 22, fontFamily: "var(--serif)" }}>{h.name}</h3>
            <table>
              <tbody>
                <tr><td>Capacity</td><td>{capacityText(h)}</td></tr>
                <tr><td>Dining</td><td>{h.dining}</td></tr>
                <tr><td>AC / kitchen / stage</td><td>{h.ac ? "AC" : "Non-AC"} · {h.kitchen ? "Kitchen" : "No kitchen"} · {h.stage ? "Stage" : "—"}</td></tr>
                <tr><td>Parking</td><td>{h.parking} cars</td></tr>
                <tr><td>Setup / clean / buffer</td><td>{h.setupHours}h · {h.teardownHours}h · {h.bufferMinutes} min</td></tr>
                <tr><td>Half day</td><td>{money(h.rates.halfDay, cur, loc)}</td></tr>
                <tr><td>Full day (24h)</td><td>{money(h.rates.fullDay, cur, loc)}</td></tr>
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
    </>
  );
}
