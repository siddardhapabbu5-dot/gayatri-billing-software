import { useMemo, useState } from "react";
import { bookingFolio, collectionsReport, occupancyStats, revenueBreakdown } from "../engine";
import { downloadCsv, formatDateDMY, money, startOfMonthISO, todayISO } from "../lib";
import { Kpi, PageHead } from "../ui";

function kindLabel(kind) {
  if (kind === "room") return "Room stay";
  if (kind === "mixed") return "Function + room";
  return "Function";
}

function viewRows(report, kind) {
  if (kind === "function") {
    return report.rows
      .filter((r) => (r.function?.total || 0) > 0)
      .map((r) => ({ ...r, ...r.function, slice: "Function" }));
  }
  if (kind === "room") {
    return report.rows
      .filter((r) => (r.room?.total || 0) > 0)
      .map((r) => ({ ...r, ...r.room, slice: "Room stay" }));
  }
  return report.rows.map((r) => ({ ...r, slice: kindLabel(r.kind) }));
}

function viewSummary(report, kind) {
  if (kind === "function") return report.function;
  if (kind === "room") return report.room;
  return report;
}

function csvLines(title, summary, rows) {
  return [
    [title],
    ["Cash received", summary.cash || 0],
    ["UPI received", summary.upi || 0],
    ["Advance amount", summary.advance || 0],
    ["Balance amount", summary.balance || 0],
    [],
    ["Guest", "Bill no", "Event date", "Type", "Cash", "UPI", "Advance", "Total", "Balance"],
    ...rows.map((r) => [
      r.name,
      r.number,
      formatDateDMY(r.date),
      r.slice || r.type,
      r.cash,
      r.upi,
      r.advance,
      r.total,
      r.balance,
    ]),
    [],
  ];
}

export default function Reports({ state }) {
  const today = todayISO();
  const monthStart = startOfMonthISO();
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [kind, setKind] = useState("all");
  const rev = revenueBreakdown(state);
  const occ = occupancyStats(state, today);
  const cur = state.property.currency;
  const loc = state.property.locale;
  const m = (n) => money(n, cur, loc);
  const report = useMemo(() => collectionsReport(state, from, to), [state, from, to]);
  const rows = viewRows(report, kind);
  const summary = viewSummary(report, kind);
  const byMethod = {};
  for (const p of state.payments) {
    if (p.type === "Refund") continue;
    byMethod[p.method] = (byMethod[p.method] || 0) + Number(p.amount);
  }
  const receivables = state.bookings
    .map((b) => ({ b, ...bookingFolio(state, b.id) }))
    .filter((x) => x.totals.balance > 0 && x.b.status !== "Cancelled");
  const avgEvent = state.folios.length
    ? Math.round(rev.gross / Math.max(1, state.bookings.filter((b) => b.type !== "Room only").length))
    : 0;
  const arr = occ.occupied ? Math.round(rev.room / Math.max(1, occ.occupied)) : 0;
  const rangeLabel = from && to ? `${formatDateDMY(from)} – ${formatDateDMY(to)}` : "All dates";
  const preset = from === today && to === today ? "today" : from === monthStart && to === today ? "month" : !from && !to ? "all" : "";
  const kindTitle = kind === "function" ? "Function" : kind === "room" ? "Room stay" : "All";

  function setPreset(which) {
    if (which === "today") {
      setFrom(today);
      setTo(today);
    } else if (which === "month") {
      setFrom(monthStart);
      setTo(today);
    } else {
      setFrom("");
      setTo("");
    }
  }

  function saveExcel() {
    const stamp = from && to ? `${from}_to_${to}` : "all";
    const head = [
      [state.property.name],
      [(state.property.address || []).join(", ")],
      ["Collections report", rangeLabel],
      [],
    ];
    let body;
    if (kind === "all") {
      body = [
        ...csvLines("FUNCTION (hall hire)", report.function, viewRows(report, "function")),
        ...csvLines("ROOM STAY", report.room, viewRows(report, "room")),
        ...csvLines("COMBINED", report, viewRows(report, "all")),
      ];
    } else {
      body = csvLines(kindTitle, summary, rows);
    }
    downloadCsv(`Gayatri-collections-${kind}-${stamp}.csv`, [...head, ...body]);
  }

  return (
    <>
      <PageHead title="Management reports" sub="Separate Function and Room stay: cash, UPI, advance and balance. Download Excel or print to PDF.">
        <button className="btn ghost" type="button" onClick={() => window.print()}>
          Print / PDF
        </button>
        <button className="btn" type="button" onClick={saveExcel}>
          Download Excel
        </button>
      </PageHead>

      <div className="print-only report-letter">
        <strong>{state.property.name}</strong>
        <div>{(state.property.address || []).join(", ")}</div>
        <div>
          Collections report · {kindTitle} · {rangeLabel}
        </div>
      </div>

      <div className="panel report-filters no-print">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="row">
            <label>
              From
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label>
              To
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
          </div>
          <div className="chips">
            <button type="button" className={`chip${preset === "today" ? " on" : ""}`} onClick={() => setPreset("today")}>
              Today
            </button>
            <button type="button" className={`chip${preset === "month" ? " on" : ""}`} onClick={() => setPreset("month")}>
              This month
            </button>
            <button type="button" className={`chip${preset === "all" ? " on" : ""}`} onClick={() => setPreset("all")}>
              All dates
            </button>
          </div>
        </div>
        <div className="chips" style={{ marginTop: 10 }}>
          {[
            ["all", "All"],
            ["function", "Function"],
            ["room", "Room stay"],
          ].map(([id, label]) => (
            <button key={id} type="button" className={`chip${kind === id ? " on" : ""}`} onClick={() => setKind(id)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="kpis">
        <Kpi k="Cash received" v={m(summary.cash)} s={`${kindTitle} · ${rangeLabel}`} tone="d" />
        <Kpi k="UPI received" v={m(summary.upi)} s={`${kindTitle} · ${rangeLabel}`} tone="c" />
        <Kpi k="Advance amount" v={m(summary.advance)} s="Collected as advance" tone="b" />
        <Kpi k="Balance amount" v={m(summary.balance)} s={`${rows.filter((r) => r.balance > 0).length} bills due`} tone="e" />
      </div>

      {kind === "all" && (
        <div className="g2" style={{ marginBottom: 12 }}>
          <div className="panel">
            <h3>Function</h3>
            <p className="muted">Hall hire for weddings and functions</p>
            <table>
              <tbody>
                <tr><td>Cash</td><td className="num">{m(report.function.cash)}</td></tr>
                <tr><td>UPI</td><td className="num">{m(report.function.upi)}</td></tr>
                <tr><td>Advance</td><td className="num">{m(report.function.advance)}</td></tr>
                <tr><td>Balance</td><td className="num">{m(report.function.balance)}</td></tr>
              </tbody>
            </table>
          </div>
          <div className="panel">
            <h3>Room stay</h3>
            <p className="muted">Room rent, extra bed and child rate</p>
            <table>
              <tbody>
                <tr><td>Cash</td><td className="num">{m(report.room.cash)}</td></tr>
                <tr><td>UPI</td><td className="num">{m(report.room.upi)}</td></tr>
                <tr><td>Advance</td><td className="num">{m(report.room.advance)}</td></tr>
                <tr><td>Balance</td><td className="num">{m(report.room.balance)}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="panel" style={{ marginBottom: 12 }}>
        <div className="panel-head">
          <h3>{kindTitle} collections by booking</h3>
          <span className="muted">
            {rows.length} booking(s) · received {m(summary.received || 0)}
          </span>
        </div>
        <p className="muted" style={{ marginTop: 0 }}>
          Function is hall hire. Room stay is guest rooms. Mixed bills split cash, UPI, advance and balance by billed share.
        </p>
        <table className="report-table">
          <thead>
            <tr>
              <th>Guest</th>
              <th>Bill no</th>
              <th>Event date</th>
              <th>Type</th>
              <th className="num">Cash</th>
              <th className="num">UPI</th>
              <th className="num">Advance</th>
              <th className="num">Total</th>
              <th className="num">Balance</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="muted">
                  No collections in this period.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={`${r.id}-${r.slice}`}>
                <td>
                  {r.name}
                  <div className="muted">{r.type}</div>
                </td>
                <td>{r.number}</td>
                <td>{formatDateDMY(r.date)}</td>
                <td>{r.slice}</td>
                <td className="num">{m(r.cash)}</td>
                <td className="num">{m(r.upi)}</td>
                <td className="num">{m(r.advance)}</td>
                <td className="num">{m(r.total)}</td>
                <td className="num">{r.balance > 0 ? m(r.balance) : "—"}</td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={4}>
                  <strong>Total</strong>
                </td>
                <td className="num">
                  <strong>{m(rows.reduce((s, r) => s + r.cash, 0))}</strong>
                </td>
                <td className="num">
                  <strong>{m(rows.reduce((s, r) => s + r.upi, 0))}</strong>
                </td>
                <td className="num">
                  <strong>{m(rows.reduce((s, r) => s + r.advance, 0))}</strong>
                </td>
                <td className="num">
                  <strong>{m(rows.reduce((s, r) => s + r.total, 0))}</strong>
                </td>
                <td className="num">
                  <strong>{m(rows.reduce((s, r) => s + r.balance, 0))}</strong>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <div className="report-extra no-print">
        <div className="kpis">
          <Kpi k="Gross billing" v={m(rev.gross)} s={`Tax ${state.property.taxName} ${state.property.taxPercent}%`} />
          <Kpi k="Hall utilization" v={`${occ.hallPct}%`} s={`${occ.hallBooked} of ${state.halls.length} halls on today's book`} />
          <Kpi k="Avg event value" v={m(avgEvent)} />
          <Kpi k="Avg room rate (proxy)" v={m(arr)} />
        </div>
        <div className="g2">
          <div className="panel">
            <h3>Revenue by service</h3>
            <table>
              <tbody>
                {Object.entries(rev.cats)
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, v]) => (
                    <tr key={k}>
                      <td>{k}</td>
                      <td className="num">{m(v)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <div className="panel">
            <h3>Collections by rail</h3>
            <table>
              <tbody>
                {Object.entries(byMethod).map(([k, v]) => (
                  <tr key={k}>
                    <td>{k}</td>
                    <td className="num">{m(v)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h3 style={{ marginTop: 16 }}>Receivables</h3>
            <table>
              <tbody>
                {receivables.map(({ b, totals }) => (
                  <tr key={b.id}>
                    <td>{b.number}</td>
                    <td className="num">{m(totals.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
