import { useState } from "react";
import { askAssistant } from "../engine";
import { PageHead } from "../ui";

export default function Assistant({ state }) {
  const [q, setQ] = useState("Show unpaid bookings above ₹1 lakh.");
  const [a, setA] = useState("");
  return (
    <>
      <PageHead title="Operations assistant" sub="Ask about revenue, occupancy, unpaid bills and upcoming events. Forecasting and smart pricing are Phase 6." />
      <div className="ai">
        <div className="panel">
          <input value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn" style={{ marginTop: 8 }} onClick={() => setA(askAssistant(state, q))}>Ask</button>
          <div className="log" style={{ marginTop: 12 }}>{a || "Try: What was our revenue? Which hall line is highest? How many rooms are available?"}</div>
        </div>
        <div className="panel">
          <h3>Suggested</h3>
          {["What was our revenue?", "Which hall generated the highest revenue?", "Show unpaid bookings above ₹1 lakh.", "How many rooms are available?"].map((s) => (
            <button key={s} className="chip" style={{ margin: "4px 0" }} onClick={() => { setQ(s); setA(askAssistant(state, s)); }}>{s}</button>
          ))}
        </div>
      </div>
    </>
  );
}
