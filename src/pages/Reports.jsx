import { useMemo, useState } from "react";
import { bookingFolio, collectionsReport, kindSplit, lineKind, occupancyStats } from "../engine";
import { downloadCsv, formatDateDMY, formatDateTime, money, startOfMonthISO, todayISO } from "../lib";
import { Kpi, PageHead, Pill } from "../ui";

function cancellationAt(state, booking) {
  if (booking.cancelledAt) return booking.cancelledAt;
  const hit = (state.audit || []).find((a) => a.entity === booking.number && a.action === "Booking cancelled");
  return hit?.at || "";
}

function cancellationRows(state, from, to) {
  return state.bookings
    .filter((b) => b.status === "Cancelled")
    .map((b) => {
      const guest = state.guests.find((g) => g.id === b.guestId);
      const { totals } = bookingFolio(state, b.id);
      const refundTotal = (state.payments || [])
        .filter((p) => p.bookingId === b.id && p.type === "Refund")
        .reduce((s, p) => s + Number(p.amount || 0), 0);
      const cancelledAt = cancellationAt(state, b);
      const audit = (state.audit || []).find((a) => a.entity === b.number && a.action === "Booking cancelled");
      return { b, guest, totals, refundTotal, cancelledAt, detail: audit?.detail || "" };
    })
    .filter((row) => {
      const d = String(row.cancelledAt).slice(0, 10);
      if (!d) return !from && !to;
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    })
    .sort((a, b) => String(b.cancelledAt).localeCompare(String(a.cancelledAt)));
}

function kindLabel(kind) {
  if (kind === "room") return "Room stay";
  if (kind === "mixed") return "Hall + room";
  return "Hall";
}

function viewRows(report, kind) {
  if (kind === "function") {
    return report.rows
      .filter((r) => (r.function?.total || 0) > 0)
      .map((r) => ({ ...r, ...r.function, slice: "Hall" }));
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

function periodRevenueBreakdown(state, report, kind) {
  const bookingIds = new Set(report.rows.map((r) => r.id));
  const cats = {};
  for (const b of state.bookings || []) {
    if (!bookingIds.has(b.id) || b.status === "Cancelled") continue;
    const { lines } = bookingFolio(state, b.id);
    for (const line of lines || []) {
      const lk = lineKind(line);
      if (kind === "function" && lk !== "function") continue;
      if (kind === "room" && lk !== "room") continue;
      const cat = line.category || "other";
      cats[cat] = (cats[cat] || 0) + Number(line.amount || 0);
    }
  }
  const gross = Object.values(cats).reduce((s, v) => s + v, 0);
  return { cats, gross };
}

function filteredReceivables(state, kind) {
  return state.bookings
    .map((b) => {
      const folio = bookingFolio(state, b.id);
      return { b, ...folio };
    })
    .filter((x) => x.totals.balance > 0 && x.b.status !== "Cancelled")
    .map((x) => {
      if (kind === "all") return { b: x.b, balance: x.totals.balance };
      const split = kindSplit(x.lines, { balance: x.totals.balance });
      const bucket = kind === "function" ? split.function : split.room;
      return { b: x.b, balance: bucket.balance || 0 };
    })
    .filter((x) => x.balance > 0);
}

function collectionsByRail(summary) {
  const out = {};
  if (summary.cash) out.Cash = summary.cash;
  if (summary.upi) out.UPI = summary.upi;
  if (summary.other) out.Other = summary.other;
  return out;
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

export default function Reports({ state, go }) {
  const today = todayISO();
  const monthStart = startOfMonthISO();
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [kind, setKind] = useState("all");
  const [reportTab, setReportTab] = useState("collections");
  const occ = occupancyStats(state, today);
  const cur = state.property.currency;
  const loc = state.property.locale;
  const m = (n) => money(n, cur, loc);
  const report = useMemo(() => collectionsReport(state, from, to), [state, from, to]);
  const cancelled = useMemo(() => cancellationRows(state, from, to), [state, from, to]);
  const allCancelled = useMemo(() => cancellationRows(state, "", ""), [state]);
  const rows = viewRows(report, kind);
  const summary = viewSummary(report, kind);
  const periodRev = useMemo(() => periodRevenueBreakdown(state, report, kind), [state, report, kind]);
  const byMethod = useMemo(() => collectionsByRail(summary), [summary]);
  const receivables = useMemo(() => filteredReceivables(state, kind), [state, kind]);
  const hallRows = useMemo(() => viewRows(report, "function"), [report]);
  const roomRows = useMemo(() => viewRows(report, "room"), [report]);
  const avgEvent =
    kind !== "room" && hallRows.length
      ? Math.round(hallRows.reduce((s, r) => s + r.total, 0) / hallRows.length)
      : 0;
  const arr =
    kind !== "function" && roomRows.length
      ? Math.round(roomRows.reduce((s, r) => s + r.total, 0) / roomRows.length)
      : 0;
  const rangeLabel = from && to ? `${formatDateDMY(from)} – ${formatDateDMY(to)}` : "All dates";
  const preset = from === today && to === today ? "today" : from === monthStart && to === today ? "month" : !from && !to ? "all" : "";
  const kindTitle = kind === "function" ? "Hall" : kind === "room" ? "Room stay" : "All";

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
      [reportTab === "cancellations" ? "Cancellations report" : "Collections report", rangeLabel],
      [],
    ];
    let body;
    if (reportTab === "cancellations") {
      body = [
        ["Guest", "Bill no", "Event date", "Cancelled on", "Type", "Billed", "Collected", "Refund", "Detail"],
        ...cancelled.map((row) => [
          row.guest?.name || "Guest",
          row.b.number,
          formatDateDMY(row.b.eventDate),
          row.cancelledAt ? formatDateTime(row.cancelledAt) : "—",
          row.b.type,
          row.totals.total,
          row.totals.paid,
          row.refundTotal,
          row.detail,
        ]),
      ];
    } else if (kind === "all") {
      body = [
        ...csvLines("HALL (hall hire)", report.function, viewRows(report, "function")),
        ...csvLines("ROOM STAY", report.room, viewRows(report, "room")),
        ...csvLines("COMBINED", report, viewRows(report, "all")),
      ];
    } else {
      body = csvLines(kindTitle, summary, rows);
    }
    downloadCsv(`Gayatri-${reportTab === "cancellations" ? "cancellations" : `collections-${kind}`}-${stamp}.csv`, [...head, ...body]);
  }

  const cancelRefundTotal = cancelled.reduce((s, row) => s + row.refundTotal, 0);
  const cancelBilledTotal = cancelled.reduce((s, row) => s + row.totals.total, 0);

  return (
    <>
      <PageHead
        title="Management reports"
        sub={
          reportTab === "cancellations"
            ? `${allCancelled.length} cancellation record(s) on file. Filter by cancellation date.`
            : "Separate hall hire and room stay: cash, UPI, advance and balance. Download Excel or print to PDF."
        }
      >
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

      <div className="chips no-print" style={{ marginBottom: 10 }}>
        <button type="button" className={`chip${reportTab === "collections" ? " on" : ""}`} onClick={() => setReportTab("collections")}>
          Collections
        </button>
        <button type="button" className={`chip${reportTab === "cancellations" ? " on" : ""}`} onClick={() => setReportTab("cancellations")}>
          Cancellations ({allCancelled.length})
        </button>
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
        {reportTab === "collections" && (
        <div className="chips" style={{ marginTop: 10 }}>
          {[
            ["all", "All"],
            ["function", "Hall"],
            ["room", "Room stay"],
          ].map(([id, label]) => (
            <button key={id} type="button" className={`chip${kind === id ? " on" : ""}`} onClick={() => setKind(id)}>
              {label}
            </button>
          ))}
        </div>
        )}
      </div>

      {reportTab === "cancellations" ? (
        <>
          <div className="kpis">
            <Kpi k="Cancellation records" v={String(cancelled.length)} s={rangeLabel} tone="e" />
            <Kpi k="Billed before cancel" v={m(cancelBilledTotal)} s="Original bill total" tone="b" />
            <Kpi k="Refunds recorded" v={m(cancelRefundTotal)} s="Cancellation refunds" tone="c" />
            <Kpi k="All time" v={String(allCancelled.length)} s="Total on file" tone="d" />
          </div>
          <div className="panel">
            <div className="panel-head">
              <h3>Cancellations</h3>
              <span className="muted">{cancelled.length} in selected period</span>
            </div>
            <table className="report-table">
              <thead>
                <tr>
                  <th>Guest</th>
                  <th>Bill no</th>
                  <th>Event date</th>
                  <th>Cancelled on</th>
                  <th>Type</th>
                  <th className="num">Billed</th>
                  <th className="num">Collected</th>
                  <th className="num">Refund</th>
                  <th>Detail</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {!cancelled.length && (
                  <tr>
                    <td colSpan={10} className="muted">
                      No cancellations in this period.
                    </td>
                  </tr>
                )}
                {cancelled.map((row) => (
                  <tr key={row.b.id}>
                    <td>
                      {row.guest?.name || "Guest"}
                      <div className="muted">{row.guest?.phone}</div>
                    </td>
                    <td>{row.b.number}</td>
                    <td>{formatDateDMY(row.b.eventDate)}</td>
                    <td>{row.cancelledAt ? formatDateTime(row.cancelledAt) : "—"}</td>
                    <td>
                      {row.b.type}
                      <div><Pill status="Cancelled">Cancelled</Pill></div>
                    </td>
                    <td className="num">{m(row.totals.total)}</td>
                    <td className="num">{row.totals.paid > 0 ? m(row.totals.paid) : "—"}</td>
                    <td className="num">{row.refundTotal > 0 ? m(row.refundTotal) : "—"}</td>
                    <td className="muted">{row.detail || "—"}</td>
                    <td>
                      {go ? (
                        <button type="button" className="btn ghost small" onClick={() => go("billing", { bookingId: row.b.id })}>
                          View bill
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
      <div className="kpis">
        <Kpi k="Cash received" v={m(summary.cash)} s={`${kindTitle} · ${rangeLabel}`} tone="d" />
        <Kpi k="UPI received" v={m(summary.upi)} s={`${kindTitle} · ${rangeLabel}`} tone="c" />
        <Kpi k="Advance amount" v={m(summary.advance)} s="Collected as advance" tone="b" />
        <Kpi k="Balance amount" v={m(summary.balance)} s={`${rows.filter((r) => r.balance > 0).length} bills due`} tone="e" />
      </div>

      {kind === "all" && (
        <div className="g2" style={{ marginBottom: 12 }}>
          <div className="panel">
            <h3>Hall</h3>
            <p className="muted">Convention hall hire</p>
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
          Hall is convention hall hire. Room stay is guest rooms. Mixed bills split cash, UPI, advance and balance by billed share.
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
          <Kpi
            k="Gross billing"
            v={m(periodRev.gross)}
            s={`${kindTitle} · ${rangeLabel} · Tax ${state.property.taxName} ${state.property.taxPercent}%`}
          />
          {kind !== "room" && (
            <Kpi k="Hall utilization" v={`${occ.hallPct}%`} s={`${occ.hallBooked} of ${state.halls.length} halls on today's book`} />
          )}
          {kind !== "room" && <Kpi k="Avg event value" v={m(avgEvent)} s={`${kindTitle} · ${rangeLabel}`} />}
          {kind !== "function" && <Kpi k="Avg room rate (proxy)" v={m(arr)} s={`${kindTitle} · ${rangeLabel}`} />}
        </div>
        <div className="g2">
          <div className="panel">
            <h3>Revenue by service</h3>
            <p className="muted">{kindTitle} · {rangeLabel}</p>
            <table>
              <tbody>
                {!Object.keys(periodRev.cats).length && (
                  <tr>
                    <td colSpan={2} className="muted">
                      No billing in this period.
                    </td>
                  </tr>
                )}
                {Object.entries(periodRev.cats)
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
            <p className="muted">{kindTitle} · {rangeLabel}</p>
            <table>
              <tbody>
                {!Object.keys(byMethod).length && (
                  <tr>
                    <td colSpan={2} className="muted">
                      No collections in this period.
                    </td>
                  </tr>
                )}
                {Object.entries(byMethod).map(([k, v]) => (
                  <tr key={k}>
                    <td>{k}</td>
                    <td className="num">{m(v)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h3 style={{ marginTop: 16 }}>Receivables</h3>
            <p className="muted">{kindTitle} balance due</p>
            <table>
              <tbody>
                {!receivables.length && (
                  <tr>
                    <td colSpan={2} className="muted">
                      No open balances.
                    </td>
                  </tr>
                )}
                {receivables.map(({ b, balance }) => (
                  <tr key={b.id}>
                    <td>{b.number}</td>
                    <td className="num">{m(balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
        </>
      )}
    </>
  );
}
