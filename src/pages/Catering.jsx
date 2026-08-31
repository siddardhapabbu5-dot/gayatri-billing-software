import { money } from "../lib";
import { PageHead } from "../ui";

export default function Catering({ state, onAdd }) {
  const cur = state.property.currency;
  const loc = state.property.locale;
  return (
    <>
      <PageHead title="Catering / F&B" sub="Expected guests → plates ordered → served → wastage → cost per guest and catering margin.">
        <button
          className="btn"
          onClick={() => {
            const bookingId = state.bookings[0]?.id;
            if (!bookingId) return;
            onAdd({
              bookingId,
              meal: "Custom buffet",
              expectedGuests: 200,
              platesOrdered: 220,
              platesServed: 0,
              wastage: 0,
              costPerPlate: 400,
              sellPerPlate: 650,
              menus: ["Lunch buffet"],
            });
          }}
        >
          Add production sheet
        </button>
      </PageHead>
      {state.cateringOrders.map((c) => {
        const revenue = c.platesOrdered * c.sellPerPlate;
        const cost = c.platesOrdered * c.costPerPlate;
        const bk = state.bookings.find((b) => b.id === c.bookingId);
        return (
          <div key={c.id} className="panel" style={{ marginBottom: 10 }}>
            <h3>{c.meal}</h3>
            <div className="muted">{bk?.number} · {c.menus.join(" · ")}</div>
            <div className="kpis" style={{ marginTop: 10 }}>
              <div className="kpi"><div className="k">Expected</div><div className="v">{c.expectedGuests}</div></div>
              <div className="kpi"><div className="k">Plates ordered</div><div className="v">{c.platesOrdered}</div></div>
              <div className="kpi"><div className="k">Cost / guest</div><div className="v">{money(c.costPerPlate, cur, loc)}</div></div>
              <div className="kpi"><div className="k">Margin</div><div className="v">{money(revenue - cost, cur, loc)}</div><div className="s">Sell {money(c.sellPerPlate, cur, loc)}</div></div>
            </div>
          </div>
        );
      })}
    </>
  );
}
