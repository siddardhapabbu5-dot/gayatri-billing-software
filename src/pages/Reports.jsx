import { useMemo, useState } from "react";
import {
  bookingFolio,
  cashbookReport,
  collectionsReport,
  gstReport,
  kindSplit,
  lineKind,
  occupancyRangeReport,
  occupancyStats,
  outstandingCustomers,
} from "../engine";
import { expenseLabel } from "../finance";
import { addDays, downloadCsv, formatDateDMY, formatDateTime, money, startOfMonthISO, todayISO } from "../lib";
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
      const reason = b.cancelReason || "";
      return {
        b,
        guest,
        totals,
        refundTotal,
        cancelledAt,
        reason,
        detail: reason || audit?.detail || "",
      };
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

function cashbookRails(book) {
  const out = {};
  if (book.rails.cash) out.Cash = book.rails.cash;
  if (book.rails.upi) out.UPI = book.rails.upi;
  if (book.rails.card) out.Card = book.rails.card;
  if (book.rails.bank) out.Bank = book.rails.bank;
  if (book.rails.other) out.Other = book.rails.other;
  if (book.creditPending) out["Credit / Pending"] = book.creditPending;
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
  const [reportTab, setReportTab] = useState("cashbook");
  const [gstSplit, setGstSplit] = useState("all");
  const occ = occupancyStats(state, today);
  const cur = state.property.currency;
  const loc = state.property.locale;
  const m = (n) => money(n, cur, loc);
  const report = useMemo(() => collectionsReport(state, from, to), [state, from, to]);
  const book = useMemo(() => cashbookReport(state, from, to), [state, from, to]);
  const gst = useMemo(() => gstReport(state, from, to), [state, from, to]);
  const occRange = useMemo(() => occupancyRangeReport(state, from || today, to || today), [state, from, to, today]);
  const outstanding = useMemo(() => outstandingCustomers(state), [state]);
  const cancelled = useMemo(() => cancellationRows(state, from, to), [state, from, to]);
  const allCancelled = useMemo(() => cancellationRows(state, "", ""), [state]);
  const rows = viewRows(report, kind);
  const summary = viewSummary(report, kind);
  const periodRev = useMemo(() => periodRevenueBreakdown(state, report, kind), [state, report, kind]);
  const byMethod = useMemo(() => collectionsByRail(summary), [summary]);
  const byCashRails = useMemo(() => cashbookRails(book), [book]);
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
  const weekStart = addDays(today, -((new Date(`${today}T12:00:00`).getDay() + 6) % 7));
  const sixMonthStart = (() => {
    const d = new Date(`${today}T12:00:00`);
    d.setMonth(d.getMonth() - 5);
    d.setDate(1);
    return todayISO(d);
  })();
  const yearStart = `${new Date(`${today}T12:00:00`).getFullYear()}-01-01`;
  const preset =
    from === today && to === today
      ? "today"
      : from === weekStart && to === today
        ? "week"
        : from === monthStart && to === today
          ? "month"
          : from === sixMonthStart && to === today
            ? "six"
            : from === yearStart && to === today
              ? "year"
              : !from && !to
                ? "all"
                : "";
  const kindTitle = kind === "function" ? "Hall" : kind === "room" ? "Room stay" : "All";

  function setPreset(which) {
    if (which === "today") {
      setFrom(today);
      setTo(today);
    } else if (which === "week") {
      setFrom(weekStart);
      setTo(today);
    } else if (which === "month") {
      setFrom(monthStart);
      setTo(today);
    } else if (which === "six") {
      setFrom(sixMonthStart);
      setTo(today);
    } else if (which === "year") {
      setFrom(yearStart);
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
      [
        reportTab === "cancellations"
          ? "Cancellations report"
          : reportTab === "cashbook"
            ? "Daily income & expense / cashbook"
            : reportTab === "outstanding"
              ? "Customer outstanding"
              : reportTab === "gst"
                ? "GST report"
                : reportTab === "occupancy"
                  ? "Occupancy report"
                  : "Collections report",
        rangeLabel,
      ],
      [],
    ];
    let body;
    if (reportTab === "cancellations") {
      body = [
        ["Guest", "Bill no", "Event date", "Cancelled on", "Type", "Billed", "Collected", "Refund", "Reason"],
        ...cancelled.map((row) => [
          row.guest?.name || "Guest",
          row.b.number,
          formatDateDMY(row.b.eventDate),
          row.cancelledAt ? formatDateTime(row.cancelledAt) : "—",
          row.b.type,
          row.totals.total,
          row.totals.paid,
          row.refundTotal,
          row.reason || row.detail,
        ]),
      ];
    } else if (reportTab === "outstanding") {
      body = [
        ["Customer", "Phone", "Bill", "Paid", "Balance", "Bookings"],
        ...outstanding.map((r) => [
          r.name,
          r.phone,
          r.bill,
          r.paid,
          r.balance,
          r.bookings.map((b) => b.number).join(" · "),
        ]),
      ];
    } else if (reportTab === "gst") {
      body = [
        ["With GST bills", gst.with.count],
        ["Taxable (with GST)", gst.with.taxable],
        ["CGST", gst.with.cgst],
        ["SGST", gst.with.sgst],
        ["Total GST", gst.with.tax],
        ["Without GST bills", gst.without.count],
        ["Without GST total", gst.without.total],
        [],
        ["Guest", "Bill no", "Date", "GST", "Taxable", "CGST", "SGST", "Tax", "Total", "Balance"],
        ...gstRows.map((r) => [
          r.name,
          r.number,
          formatDateDMY(r.date),
          r.gstMode === "with" ? "With GST" : "Without GST",
          r.taxable,
          r.cgst,
          r.sgst,
          r.tax,
          r.total,
          r.balance,
        ]),
      ];
    } else if (reportTab === "occupancy") {
      body = [
        ["Avg room occupancy %", occRange.avgRoomOcc],
        ["Avg hall occupancy %", occRange.avgHallOcc],
        ["Room nights", occRange.roomNights],
        ["Hall-days booked", occRange.hallDays],
        [],
        ["Date", "Rooms occupied", "Live rooms", "Room %", "Halls booked", "Hall %"],
        ...occRange.days.map((d) => [formatDateDMY(d.date), d.occupied, d.live, d.occPct, d.hallBooked, d.hallPct]),
      ];
    } else if (reportTab === "cashbook") {
      body = [
        ["Opening balance", book.opening],
        ["Collections (gross in)", book.incomeGross],
        ["Customer refunds (out)", book.refundTotal],
        ["Room income (net share)", book.room],
        ["Function hall income (net share)", book.hall],
        ["Food income (net share)", book.food],
        ["Other income (net share)", book.otherIncome],
        ["Advances received", book.advance],
        ["Net income (collections − refunds)", book.incomeTotal],
        [],
        ...Object.entries(book.expenseByCat).map(([k, v]) => [expenseLabel(k), v]),
        ["Total expenses", book.expenseTotal],
        ["Net after expenses", book.net],
        ["Closing balance", book.closing],
        [],
        ["Cash (net)", book.rails.cash],
        ["UPI (net)", book.rails.upi],
        ["Card (net)", book.rails.card],
        ["Bank (net)", book.rails.bank],
        ["Credit / Pending (all open)", book.creditPending],
        [],
        ["FULL PAYMENT & REFUND REGISTER"],
        [
          "Date",
          "Date-time",
          "In/Out",
          "Kind",
          "Mode",
          "Amount",
          "Guest",
          "Phone",
          "Bill no",
          "Receipt",
          "Ref / UTR",
          "Notes",
        ],
        ...(book.ledger || []).map((r) => [
          formatDateDMY(r.day),
          r.at ? formatDateTime(r.at) : "",
          r.flow,
          r.kind,
          r.method,
          r.amount,
          r.guest,
          r.phone,
          r.billNo,
          r.receiptNo,
          r.ref,
          r.notes,
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
    downloadCsv(`Gayatri-${reportTab}-${stamp}.csv`, [...head, ...body]);
  }

  const cancelRefundTotal = cancelled.reduce((s, row) => s + row.refundTotal, 0);
  const cancelBilledTotal = cancelled.reduce((s, row) => s + row.totals.total, 0);
  const outstandingTotal = outstanding.reduce((s, r) => s + r.balance, 0);
  const gstRows =
    gstSplit === "with" ? gst.withGst : gstSplit === "without" ? gst.withoutGst : gst.rows;

  return (
    <>
      <PageHead
        title="Management reports"
        sub={
          reportTab === "cancellations"
            ? `${allCancelled.length} cancellation record(s) on file. Filter by cancellation date.`
            : reportTab === "cashbook"
              ? "Full cash register: every collection and refund line (e.g. Sriram paid + cash refund). Day / week / month or custom range."
              : reportTab === "outstanding"
                ? "Customers with balance still to collect."
                : reportTab === "gst"
                  ? "Split With GST and Without GST bills. CGST + SGST for taxable invoices."
                  : reportTab === "occupancy"
                    ? "Day-wise room and function-hall occupancy for the selected range."
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
          {reportTab} · {kindTitle} · {rangeLabel}
        </div>
      </div>

      <div className="chips no-print" style={{ marginBottom: 10 }}>
        <button type="button" className={`chip${reportTab === "cashbook" ? " on" : ""}`} onClick={() => setReportTab("cashbook")}>
          Income & expense
        </button>
        <button type="button" className={`chip${reportTab === "gst" ? " on" : ""}`} onClick={() => setReportTab("gst")}>
          GST
        </button>
        <button type="button" className={`chip${reportTab === "occupancy" ? " on" : ""}`} onClick={() => setReportTab("occupancy")}>
          Occupancy
        </button>
        <button type="button" className={`chip${reportTab === "collections" ? " on" : ""}`} onClick={() => setReportTab("collections")}>
          Collections
        </button>
        <button type="button" className={`chip${reportTab === "outstanding" ? " on" : ""}`} onClick={() => setReportTab("outstanding")}>
          Outstanding ({outstanding.length})
        </button>
        <button type="button" className={`chip${reportTab === "cancellations" ? " on" : ""}`} onClick={() => setReportTab("cancellations")}>
          Cancellations ({allCancelled.length})
        </button>
      </div>

      <div className="panel report-filters no-print">
        <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
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
            {[
              ["today", "Today"],
              ["week", "This week"],
              ["month", "This month"],
              ["six", "6 months"],
              ["year", "This year"],
              ["all", "All dates"],
            ].map(([id, label]) => (
              <button key={id} type="button" className={`chip${preset === id ? " on" : ""}`} onClick={() => setPreset(id)}>
                {label}
              </button>
            ))}
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
        {reportTab === "gst" && (
          <div className="chips" style={{ marginTop: 10 }}>
            {[
              ["all", "All bills"],
              ["with", "With GST only"],
              ["without", "Without GST only"],
            ].map(([id, label]) => (
              <button key={id} type="button" className={`chip${gstSplit === id ? " on" : ""}`} onClick={() => setGstSplit(id)}>
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {reportTab === "gst" ? (
        <>
          <div className="kpis">
            <Kpi k="With GST bills" v={String(gst.with.count)} s={rangeLabel} tone="b" />
            <Kpi k="Taxable value" v={m(gst.with.taxable)} s="Before GST" tone="a" />
            <Kpi k="CGST" v={m(gst.with.cgst)} s="Half of GST" tone="c" />
            <Kpi k="SGST" v={m(gst.with.sgst)} s="Half of GST" tone="c" />
            <Kpi k="Total GST" v={m(gst.with.tax)} s={`${state.property.taxPercent}%`} tone="d" />
            <Kpi k="Without GST bills" v={String(gst.without.count)} s={m(gst.without.total)} tone="e" />
          </div>
          <div className="g2" style={{ marginBottom: 12 }}>
            <div className="panel">
              <h3>With GST</h3>
              <table>
                <tbody>
                  <tr><td>Bills</td><td>{gst.with.count}</td></tr>
                  <tr><td>Taxable</td><td>{m(gst.with.taxable)}</td></tr>
                  <tr><td>CGST</td><td>{m(gst.with.cgst)}</td></tr>
                  <tr><td>SGST</td><td>{m(gst.with.sgst)}</td></tr>
                  <tr><td><strong>Invoice total</strong></td><td><strong>{m(gst.with.total)}</strong></td></tr>
                </tbody>
              </table>
            </div>
            <div className="panel">
              <h3>Without GST</h3>
              <table>
                <tbody>
                  <tr><td>Bills</td><td>{gst.without.count}</td></tr>
                  <tr><td>Taxable / bill value</td><td>{m(gst.without.taxable)}</td></tr>
                  <tr><td>GST</td><td>{m(0)}</td></tr>
                  <tr><td><strong>Invoice total</strong></td><td><strong>{m(gst.without.total)}</strong></td></tr>
                </tbody>
              </table>
            </div>
          </div>
          <div className="panel">
            <table>
              <thead>
                <tr>
                  <th>Guest</th>
                  <th>Bill no</th>
                  <th>Date</th>
                  <th>GST</th>
                  <th>Taxable</th>
                  <th>CGST</th>
                  <th>SGST</th>
                  <th>Total</th>
                  <th>Balance</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {!gstRows.length && (
                  <tr><td colSpan={10} className="muted">No bills in this period.</td></tr>
                )}
                {gstRows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.name}<div className="muted">{r.phone}</div></td>
                    <td>{r.number}</td>
                    <td>{formatDateDMY(r.date)}</td>
                    <td>{r.gstMode === "with" ? `With GST ${r.taxRate}%` : "Without GST"}</td>
                    <td>{m(r.taxable)}</td>
                    <td>{m(r.cgst)}</td>
                    <td>{m(r.sgst)}</td>
                    <td>{m(r.total)}</td>
                    <td>{m(r.balance)}</td>
                    <td>
                      {go ? (
                        <button type="button" className="btn ghost small" onClick={() => go("billing", { bookingId: r.id })}>
                          Open
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : reportTab === "occupancy" ? (
        <>
          <div className="kpis">
            <Kpi k="Avg room occupancy" v={`${occRange.avgRoomOcc}%`} s={rangeLabel} tone="c" />
            <Kpi k="Avg hall occupancy" v={`${occRange.avgHallOcc}%`} s={rangeLabel} tone="a" />
            <Kpi k="Room nights" v={String(occRange.roomNights)} s="Occupied room-days" tone="b" />
            <Kpi k="Hall-days booked" v={String(occRange.hallDays)} s="Hall × day holds" tone="d" />
          </div>
          <div className="panel">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Rooms occupied</th>
                  <th>Live rooms</th>
                  <th>Room %</th>
                  <th>Halls booked</th>
                  <th>Hall %</th>
                </tr>
              </thead>
              <tbody>
                {!occRange.days.length && (
                  <tr><td colSpan={6} className="muted">Pick a from/to date range.</td></tr>
                )}
                {occRange.days.map((d) => (
                  <tr key={d.date}>
                    <td>{formatDateDMY(d.date)}</td>
                    <td>{d.occupied}</td>
                    <td>{d.live}</td>
                    <td>{d.occPct}%</td>
                    <td>{d.hallBooked}/{state.halls.length}</td>
                    <td>{d.hallPct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : reportTab === "cashbook" ? (
        <>
          <div className="kpis">
            <Kpi k="Opening balance" v={m(book.opening)} s="Before range start" tone="a" />
            <Kpi k="Collections in" v={m(book.incomeGross)} s={`${book.paymentCount} receipt(s)`} tone="b" />
            <Kpi k="Refunds out" v={m(book.refundTotal)} s={`${book.refundCount} refund(s)`} tone="e" />
            <Kpi k="Net money in" v={m(book.incomeTotal)} s="Collections − refunds" tone="c" />
            <Kpi k="Expenses" v={m(book.expenseTotal)} s={`${book.expenses.length} entry(ies)`} tone="e" />
            <Kpi k="Closing balance" v={m(book.closing)} s="Opening + net − expenses" tone="d" />
          </div>
          <div className="panel" style={{ marginBottom: 12 }}>
            <div className="panel-head">
              <h3>Full payment &amp; refund register</h3>
              <span className="muted">{(book.ledger || []).length} line(s) · {rangeLabel}</span>
            </div>
            <p className="muted" style={{ marginTop: 0 }}>
              Every cash movement in this period — collection and refund separately (not only net). Example: collection ₹10,266 then refund ₹2,950 both appear.
            </p>
            <table className="report-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>In / Out</th>
                  <th>Kind</th>
                  <th>Mode</th>
                  <th>Guest</th>
                  <th>Bill no</th>
                  <th className="num">Amount</th>
                  <th>Receipt / Ref</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {!(book.ledger || []).length && (
                  <tr>
                    <td colSpan={9} className="muted">No payments, refunds or expenses in this range.</td>
                  </tr>
                )}
                {(book.ledger || []).map((r) => (
                  <tr key={r.id}>
                    <td>
                      {formatDateDMY(r.day)}
                      {r.at ? <div className="muted">{formatDateTime(r.at)}</div> : null}
                    </td>
                    <td>{r.flow}</td>
                    <td>{r.kind}</td>
                    <td>{r.method || "—"}</td>
                    <td>
                      {r.guest}
                      {r.phone ? <div className="muted">{r.phone}</div> : null}
                    </td>
                    <td>{r.billNo || "—"}</td>
                    <td className="num">{m(r.amount)}</td>
                    <td>{[r.receiptNo, r.ref].filter(Boolean).join(" · ") || "—"}</td>
                    <td>{r.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="g2">
            <div className="panel">
              <h3>Income share ({rangeLabel})</h3>
              <table>
                <tbody>
                  <tr><td>Room income</td><td>{m(book.room)}</td></tr>
                  <tr><td>Function hall income</td><td>{m(book.hall)}</td></tr>
                  <tr><td>Food income</td><td>{m(book.food)}</td></tr>
                  <tr><td>Other income</td><td>{m(book.otherIncome)}</td></tr>
                  <tr><td>Advances received</td><td>{m(book.advance)}</td></tr>
                  <tr><td><strong>Net after refunds</strong></td><td><strong>{m(book.incomeTotal)}</strong></td></tr>
                </tbody>
              </table>
            </div>
            <div className="panel">
              <h3>Expenses ({rangeLabel})</h3>
              <table>
                <tbody>
                  {!Object.keys(book.expenseByCat).length && (
                    <tr><td colSpan={2} className="muted">No expenses — add via Expense entry.</td></tr>
                  )}
                  {Object.entries(book.expenseByCat).map(([k, v]) => (
                    <tr key={k}><td>{expenseLabel(k)}</td><td>{m(v)}</td></tr>
                  ))}
                  <tr><td><strong>Total expenses</strong></td><td><strong>{m(book.expenseTotal)}</strong></td></tr>
                  <tr><td><strong>Net after expenses</strong></td><td><strong>{m(book.net)}</strong></td></tr>
                </tbody>
              </table>
            </div>
          </div>
          <div className="panel" style={{ marginTop: 12 }}>
            <h3>Collections by rail (net of refunds)</h3>
            <div className="kpis">
              {Object.entries(byCashRails).map(([k, v]) => (
                <Kpi key={k} k={k} v={m(v)} s={rangeLabel} tone="a" />
              ))}
            </div>
            <p className="muted" style={{ marginTop: 8 }}>
              Room occupancy today {occ.occPct}% · Halls booked today {occ.hallBooked}/{state.halls.length}.
              Use Expense entry to post diesel, tea, salaries and other costs.
            </p>
          </div>
          <div className="panel" style={{ marginTop: 12 }}>
            <h3>Credit &amp; balance sheet (day)</h3>
            <p className="muted" style={{ marginTop: 0 }}>
              Collections and refunds are listed separately above. Closing cash = Opening + collections − refunds − expenses.
            </p>
            <div className="g2">
              <table>
                <tbody>
                  <tr><td>Opening balance</td><td>{m(book.balanceSheet.opening)}</td></tr>
                  <tr><td>+ Cash collections</td><td>{m(book.balanceSheet.collections.cash)}</td></tr>
                  <tr><td>+ UPI collections</td><td>{m(book.balanceSheet.collections.upi)}</td></tr>
                  <tr><td>+ Card collections</td><td>{m(book.balanceSheet.collections.card)}</td></tr>
                  <tr><td>+ Bank collections</td><td>{m(book.balanceSheet.collections.bank)}</td></tr>
                  <tr><td>− Cash refunds</td><td>{m(book.balanceSheet.refunds.cash)}</td></tr>
                  <tr><td>− UPI refunds</td><td>{m(book.balanceSheet.refunds.upi)}</td></tr>
                  <tr><td>− Expenses</td><td>{m(book.balanceSheet.expenses)}</td></tr>
                  <tr><td><strong>Closing cash</strong></td><td><strong>{m(book.balanceSheet.closingCash)}</strong></td></tr>
                </tbody>
              </table>
              <table>
                <tbody>
                  <tr><td>Credit / receivables (all open bills)</td><td>{m(book.balanceSheet.creditReceivable)}</td></tr>
                  <tr><td>Advances in this period</td><td>{m(book.advance)}</td></tr>
                  <tr><td>Refunds total (all modes)</td><td>{m(book.balanceSheet.refundTotal)}</td></tr>
                  <tr><td><strong>Closing cash + credit</strong></td><td><strong>{m(book.balanceSheet.netWorthProxy)}</strong></td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : reportTab === "outstanding" ? (
        <>
          <div className="kpis">
            <Kpi k="Customers due" v={String(outstanding.length)} s="With open balance" tone="e" />
            <Kpi k="Total receivable" v={m(outstandingTotal)} s="All open bills" tone="d" />
          </div>
          <div className="panel">
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Phone</th>
                  <th>Bill</th>
                  <th>Paid</th>
                  <th>Balance</th>
                  <th>Bookings</th>
                </tr>
              </thead>
              <tbody>
                {!outstanding.length && (
                  <tr><td colSpan={6} className="muted">No outstanding balances.</td></tr>
                )}
                {outstanding.map((r) => (
                  <tr key={r.guestId || r.name}>
                    <td>{r.name}</td>
                    <td>{r.phone || "—"}</td>
                    <td>{m(r.bill)}</td>
                    <td>{m(r.paid)}</td>
                    <td><strong>{m(r.balance)}</strong></td>
                    <td>
                      {r.bookings.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          className="btn ghost small"
                          style={{ marginRight: 4 }}
                          onClick={() => go?.("billing", { bookingId: b.id })}
                        >
                          {b.number}
                        </button>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : reportTab === "cancellations" ? (
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
                  <th>Reason</th>
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
                    <td>{row.reason || row.detail || "—"}</td>
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
