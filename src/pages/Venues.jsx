import { capacityText, money } from "../lib";
import { PageHead, Pill } from "../ui";

function seatingText(hall) {
  const list = Array.isArray(hall?.seating) ? hall.seating : [];
  return list.length ? list.join(", ") : "—";
}

function hallRates(hall) {
  const nested = hall?.rates && typeof hall.rates === "object" ? hall.rates : null;
  return {
    halfDay: Number(nested?.halfDay ?? hall?.halfDayRate ?? 0),
    fullDay: Number(nested?.fullDay ?? hall?.fullDayRate ?? 0),
  };
}

export default function Venues({ state, onHall }) {
  const cur = state.property.currency;
  const loc = state.property.locale;
  const halls = Array.isArray(state.halls) ? state.halls : [];
  return (
    <>
      <PageHead title="Venues" sub="Capacity, amenities, setup/teardown and slot rates. Weekend and seasonal rules apply at reservation time." />
      <div className="g3">
        {halls.map((h) => {
          const rates = hallRates(h);
          return (
            <div key={h.id} className="panel">
              <div className="muted">
                {h.code || "—"} · {h.kind || "Hall"}
              </div>
              <h3 style={{ fontSize: 22, fontFamily: "var(--serif)" }}>{h.name || "Venue"}</h3>
              <table>
                <tbody>
                  <tr>
                    <td>Capacity</td>
                    <td>{capacityText(h)}</td>
                  </tr>
                  <tr>
                    <td>Dining</td>
                    <td>{h.dining != null && h.dining !== "" ? h.dining : "—"}</td>
                  </tr>
                  <tr>
                    <td>AC / kitchen / stage</td>
                    <td>
                      {h.ac ? "AC" : "Non-AC"} · {h.kitchen ? "Kitchen" : "No kitchen"} · {h.stage ? "Stage" : "—"}
                    </td>
                  </tr>
                  <tr>
                    <td>Parking</td>
                    <td>{Number(h.parking) || 0} cars</td>
                  </tr>
                  <tr>
                    <td>Setup / clean / buffer</td>
                    <td>
                      {Number(h.setupHours) || 0}h · {Number(h.teardownHours) || 0}h · {Number(h.bufferMinutes) || 0} min
                    </td>
                  </tr>
                  <tr>
                    <td>Half day</td>
                    <td>{money(rates.halfDay, cur, loc)}</td>
                  </tr>
                  <tr>
                    <td>Full day (24h)</td>
                    <td>{money(rates.fullDay, cur, loc)}</td>
                  </tr>
                  <tr>
                    <td>Seating</td>
                    <td>{seatingText(h)}</td>
                  </tr>
                </tbody>
              </table>
              <div className="row" style={{ marginTop: 8 }}>
                <Pill status={h.active ? "Available" : "Cancelled"}>{h.active ? "Sellable" : "Inactive"}</Pill>
                <button
                  className="btn ghost small"
                  onClick={() => {
                    const v = window.prompt("Full-day rate", rates.fullDay);
                    if (v != null) onHall(h.id, { rates: { ...rates, fullDay: Number(v) || 0 } });
                  }}
                >
                  Edit full-day rate
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
