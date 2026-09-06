import { useMemo, useState } from "react";
import { bookingFolio, collectionsReport, lineKind } from "../engine";
import { downloadCsv, formatDate, formatDateDMY, formatDateTime, gstinText, money, todayISO } from "../lib";
import { TERM_SECTIONS, sectionLines, termSetsOf } from "../policies";
import { PageHead, Pill } from "../ui";

const DOCS = ["Quotation", "Proforma invoice", "Tax invoice", "Advance receipt", "Payment receipt", "Credit note", "Debit note", "Refund receipt", "Final invoice"];
const MODES = ["Cash", "UPI", "Card", "Net banking", "Bank transfer"];

function payKind(p) {
  if (p.type === "Advance") return "Advance";
  if (p.type === "Final") return "Final payment";
  if (p.type === "Refund" || p.type === "Deposit return") return "Refund";
  if (p.type === "Deposit") return "Deposit";
  return "Settlement";
}

function stayFor(state, booking) {
  const rooms = (state.roomReservations || []).filter((r) => r.bookingId === booking.id && r.status !== "Cancelled");
  const halls = (state.hallReservations || []).filter((r) => r.bookingId === booking.id && r.status !== "Cancelled");
  const roomNos = rooms.map((r) => state.rooms.find((x) => x.id === r.roomId)?.number).filter(Boolean);
  const hallNames = halls.map((h) => state.halls.find((x) => x.id === h.hallId)?.name).filter(Boolean);
  let from = booking.eventDate;
  let to = booking.eventDate;
  if (rooms.length) {
    from = [...rooms.map((r) => r.checkIn)].sort()[0];
    to = [...rooms.map((r) => r.checkOut)].sort().slice(-1)[0];
  } else if (halls.length) {
    from = String(halls[0].start || halls[0].date || booking.eventDate).slice(0, 10);
    to = String(halls[0].end || halls[0].date || booking.eventDate).slice(0, 10);
  }
  return {
    roomLabel: roomNos.length ? roomNos.join(", ") : hallNames[0] || "—",
    from,
    to,
  };
}

function ledger(pays, totals) {
  const advance = pays
    .filter((p) => p.type === "Advance")
    .reduce((s, p) => s + Number(p.amount || 0), 0);
  const settled = pays.filter((p) => p.type !== "Advance" && p.type !== "Refund");
  let settlement = "";
  if (totals.balance <= 0 && settled.length) {
    settlement = settled.map((p) => p.method).filter(Boolean).join(", ");
  } else if (totals.balance <= 0 && advance > 0 && !settled.length) {
    settlement = "Advance";
  }
  return { advance, settlement };
}

function partyMatch(state, booking, pays, q) {
  const needle = String(q || "").trim().toLowerCase();
  if (!needle) return true;
  const guest = state.guests.find((g) => g.id === booking.guestId);
  const hay = [
    booking.number,
    guest?.name,
    guest?.phone,
    guest?.email,
    guest?.gstin,
    ...(pays || []).map((p) => p.ref),
    ...(pays || []).map((p) => p.method),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(needle);
}

export default function Billing({ state, focusId, onPay, onDiscount, onIssue, onClose, onBack, onDocs, backLabel }) {
  const [open, setOpen] = useState(focusId || null);
  const [partyQuery, setPartyQuery] = useState("");
  const booking = state.bookings.find((b) => b.id === open);
  const cur = state.property.currency;
  const loc = state.property.locale;
  const m = (n) => money(n, cur, loc);

  if (booking) {
    const { folio, lines, pays, totals } = bookingFolio(state, booking.id);
    const guest = state.guests.find((g) => g.id === booking.guestId);
    const docs = state.invoices.filter((i) => i.bookingId === booking.id);
    const halls = state.hallReservations.filter((r) => r.bookingId === booking.id);
    const rooms = state.roomReservations.filter((r) => r.bookingId === booking.id);

    return (
      <>
        <PageHead title={booking.number} sub={`Step 2 — ${guest?.name} · party booking no. ${booking.number} · Print / PDF for final bill`}>
          <button
            className="btn ghost"
            onClick={() => {
              setOpen(null);
              if (onBack) onBack();
              else onClose?.();
            }}
          >
            {backLabel || "Back"}
          </button>
          <button className="btn ghost" onClick={() => onDocs?.(booking.id)}>KYC documents</button>
          <button className="btn" onClick={() => window.print()}>Print / PDF</button>
        </PageHead>
        <div className="invoice">
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div>
              <div className="muted">{state.property.tagline}</div>
              <h1>{state.property.name}</h1>
              {state.property.address.map((l) => <div key={l} className="muted">{l}</div>)}
              <div className="muted">{state.property.phone} · {state.property.email}</div>
              <div className="muted">Gayatri GST {gstinText(state.property.gstin)}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="muted">Party booking no.</div>
              <strong>{booking.number}</strong>
              <div className="muted">Use this number to find the party later</div>
              <div><Pill status={booking.status} /></div>
              <div className="muted">{state.property.taxName} {state.property.taxPercent}%</div>
              <div className="muted">{state.property.currency} · {state.property.timezone}</div>
            </div>
          </div>
          <div className="orn" />
          <div className="g2">
            <div>
              <div className="muted">Bill to</div>
              <strong>{guest?.name}</strong>
              <div>{guest?.phone}</div>
              <div className="muted">{guest?.address}</div>
              <div className="muted">Customer GST {gstinText(guest?.gstin)}</div>
            </div>
            <div>
              {halls.map((h) => {
                const hall = state.halls.find((x) => x.id === h.hallId);
                return <div key={h.id}>{hall?.name} · {h.slotType} · {h.start.replace("T", " ")} → {h.end.replace("T", " ")}</div>;
              })}
              {rooms.map((r) => {
                const room = state.rooms.find((x) => x.id === r.roomId);
                return <div key={r.id}>Room {room?.number} · {r.checkIn} to {r.checkOut}</div>;
              })}
            </div>
          </div>
          <table style={{ marginTop: 16 }}>
            <thead><tr><th>Charge</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
            <tbody>
              {lines.some((l) => lineKind(l) === "function") && (
                <tr><td colSpan={4}><strong>Hall</strong></td></tr>
              )}
              {lines.filter((l) => lineKind(l) === "function").map((l) => (
                <tr key={l.id}>
                  <td>{l.description}<div className="muted">{l.category}</div></td>
                  <td>{l.qty}</td>
                  <td>{m(l.unitPrice)}</td>
                  <td>{m(l.amount)}</td>
                </tr>
              ))}
              {lines.some((l) => lineKind(l) === "room") && (
                <tr><td colSpan={4}><strong>Room stay</strong></td></tr>
              )}
              {lines.filter((l) => lineKind(l) === "room").map((l) => (
                <tr key={l.id}>
                  <td>{l.description}<div className="muted">{l.category}</div></td>
                  <td>{l.qty}</td>
                  <td>{m(l.unitPrice)}</td>
                  <td>{m(l.amount)}</td>
                </tr>
              ))}
              <tr><td colSpan={3}>Hall subtotal</td><td>{m(lines.filter((l) => lineKind(l) === "function").reduce((s, l) => s + Number(l.amount || 0), 0))}</td></tr>
              <tr><td colSpan={3}>Room stay subtotal</td><td>{m(lines.filter((l) => lineKind(l) === "room").reduce((s, l) => s + Number(l.amount || 0), 0))}</td></tr>
              <tr><td colSpan={3}>Subtotal</td><td>{m(totals.subtotal)}</td></tr>
              <tr><td colSpan={3}>Discount</td><td>{m(totals.discount)}</td></tr>
              <tr><td colSpan={3}>{state.property.taxName} {totals.tax ? state.property.taxPercent : 0}%</td><td>{m(totals.tax)}</td></tr>
              <tr><td colSpan={3}><strong>Total</strong></td><td><strong>{m(totals.total)}</strong></td></tr>
              <tr><td colSpan={3}>Advance paid</td><td>{m(pays.filter((p) => p.type === "Advance").reduce((s, p) => s + Number(p.amount || 0), 0))}</td></tr>
              <tr><td colSpan={3}>Final payment</td><td>{m(pays.filter((p) => p.type === "Final").reduce((s, p) => s + Number(p.amount || 0), 0))}</td></tr>
              <tr><td colSpan={3}>Other collections</td><td>{m(pays.filter((p) => !["Advance", "Final", "Refund", "Deposit return"].includes(p.type)).reduce((s, p) => s + Number(p.amount || 0), 0))}</td></tr>
              <tr><td colSpan={3}>Paid (all)</td><td>{m(totals.paid)}</td></tr>
              {Number(totals.deposit) > 0 && (
                <tr><td colSpan={3}>Security deposit held</td><td>{m(totals.deposit)}</td></tr>
              )}
              <tr className={totals.balance > 0 ? "due-row" : ""}>
                <td colSpan={3}><strong>Remaining to collect</strong></td>
                <td><strong>{m(totals.balance)}</strong></td>
              </tr>
            </tbody>
          </table>
          {pays.length > 0 && (
            <table style={{ marginTop: 16 }}>
              <thead>
                <tr>
                  <th>Payment date</th>
                  <th>Kind</th>
                  <th>Mode</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {[...pays]
                  .sort((a, b) => String(a.at).localeCompare(String(b.at)))
                  .map((p) => (
                  <tr key={p.id}>
                    <td>{formatDateTime(p.at)}</td>
                    <td>{payKind(p)}</td>
                    <td>{p.method}{p.ref ? ` · ${p.ref}` : ""}</td>
                    <td>{m(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="invoice-terms">
            <h4>Terms and conditions</h4>
            <p className="muted">
              Version v{booking.termsVersion || termSetsOf(state.property).version}. By paying this bill the guest agrees to the terms below.
            </p>
            {TERM_SECTIONS.map((sec) => {
              const lines = sectionLines(termSetsOf(state.property).sections[sec.id], state.property);
              if (!lines.length) return null;
              return (
                <div key={sec.id}>
                  <h4 style={{ marginTop: 12 }}>{sec.label}</h4>
                  <ol>
                    {lines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ol>
                </div>
              );
            })}
          </div>
        </div>
        <div className={`due-box no-print ${totals.balance > 0 ? "is-due" : "is-paid"}`}>
          {totals.balance > 0 ? (
            <div>
              <div className="muted">Remaining amount (balance)</div>
              <strong>{m(totals.balance)}</strong>
              <p className="muted" style={{ margin: "4px 0 0" }}>
                Total {m(totals.total)} − advance and payments {m(totals.paid)}. Use Payments → Save settlement when the guest pays the rest.
              </p>
            </div>
          ) : (
            <div>
              <div className="muted">Remaining amount</div>
              <strong>{m(0)}</strong>
              <p className="muted" style={{ margin: "4px 0 0" }}>Settled. Nothing left to collect.</p>
            </div>
          )}
        </div>
        <div className="g2 no-print" style={{ marginTop: 12 }}>
          <div className="panel">
            <h3>Payments</h3>
            <p className="muted" style={{ margin: "0 0 8px" }}>
              Advance and later collections. Remaining: {m(totals.balance)}
            </p>
            <table>
              <thead>
                <tr>
                  <th>Payment date</th>
                  <th>Kind</th>
                  <th>Mode</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {pays.map((p) => (
                  <tr key={p.id}>
                    <td>{formatDateTime(p.at)}</td>
                    <td>{payKind(p)}</td>
                    <td>{p.method}{p.ref ? ` · ${p.ref}` : ""}</td>
                    <td>{m(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {folio && (
              <form
                className="fields two"
                style={{ marginTop: 10 }}
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.target);
                  const amount = Number(fd.get("amount"));
                  const method = String(fd.get("method") || "Cash");
                  const date = String(fd.get("date") || todayISO());
                  const type = String(fd.get("type") || "Payment");
                  if (!amount) return;
                  onPay(folio.id, { amount, method, type, date });
                  e.target.reset();
                }}
              >
                <label>
                  Collect remaining
                  <input name="amount" type="number" min="1" defaultValue={Math.max(0, Math.round(totals.balance)) || ""} placeholder="Amount" />
                </label>
                <label>
                  Payment date
                  <input name="date" type="date" defaultValue={todayISO()} />
                </label>
                <label>
                  Payment mode
                  <select name="method" defaultValue="Cash">
                    {MODES.map((mode) => (
                      <option key={mode}>{mode}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Kind
                  <select name="type" defaultValue="Payment">
                    <option value="Advance">Advance</option>
                    <option value="Final">Final payment</option>
                    <option value="Payment">Settlement</option>
                    <option value="Deposit">Security deposit</option>
                  </select>
                </label>
                <button className="btn small" type="submit">Save settlement</button>
                <button
                  className="btn ghost small"
                  type="button"
                  onClick={() => {
                    const d = window.prompt("Discount", folio.discount);
                    if (d != null) onDiscount(folio.id, d);
                  }}
                >
                  Discount
                </button>
                <button
                  className="btn danger small"
                  type="button"
                  onClick={() => {
                    const amount = window.prompt("Refund amount");
                    if (amount) onPay(folio.id, { amount, method: "Bank transfer", type: "Refund", date: todayISO() });
                  }}
                >
                  Refund
                </button>
              </form>
            )}
          </div>
          <div className="panel">
            <h3>Documents</h3>
            {docs.map((d) => (
              <div key={d.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
                <span>{d.number}</span>
                <span className="muted">{d.type} · {formatDate(d.at)}</span>
              </div>
            ))}
            <div className="chips" style={{ marginTop: 10 }}>
              {DOCS.map((t) => (
                <button key={t} className="chip" onClick={() => onIssue(booking.id, t)}>{t}</button>
              ))}
            </div>
          </div>
        </div>
      </>
    );
  }

  const rows = useMemo(
    () =>
      state.bookings
        .filter((b) => b.status !== "Cancelled")
        .map((b) => ({ b, ...bookingFolio(state, b.id), stay: stayFor(state, b) }))
        .filter(({ b, pays }) => partyMatch(state, b, pays, partyQuery)),
    [state, partyQuery]
  );
  return (
    <>
      <PageHead title="Payment & Invoice" sub="Search by party booking no. (BK-…), guest name, phone or UPI/ref. Open a row for advance or final payment.">
        <button className="btn ghost" type="button" onClick={() => window.print()}>
          Print / PDF
        </button>
        <button
          className="btn"
          type="button"
          onClick={() => {
            const report = collectionsReport(state, "", "");
            downloadCsv(`Gayatri-payments-${todayISO()}.csv`, [
              [state.property.name],
              ["Payment & Invoice"],
              [],
              ["HALL"],
              ["Cash received", report.function.cash],
              ["UPI received", report.function.upi],
              ["Advance amount", report.function.advance],
              ["Balance amount", report.function.balance],
              [],
              ["ROOM STAY"],
              ["Cash received", report.room.cash],
              ["UPI received", report.room.upi],
              ["Advance amount", report.room.advance],
              ["Balance amount", report.room.balance],
              [],
              ["Guest", "Bill no", "Gayatri GST", "Customer GST", "Event date", "Type", "Cash", "UPI", "Advance", "Total", "Balance"],
              ...report.rows.map((r) => [
                r.name,
                r.number,
                gstinText(state.property.gstin),
                gstinText(r.gstin),
                formatDateDMY(r.date),
                r.kind === "room" ? "Room stay" : r.kind === "mixed" ? "Hall + room" : "Hall",
                r.cash,
                r.upi,
                r.advance,
                r.total,
                r.balance,
              ]),
            ]);
          }}
        >
          Download Excel
        </button>
      </PageHead>
      <div className="panel no-print" style={{ marginBottom: 12 }}>
        <label style={{ display: "block", margin: 0 }}>
          Find party
          <input
            type="search"
            value={partyQuery}
            onChange={(e) => setPartyQuery(e.target.value)}
            placeholder="BK-2026-00001 · name · phone · UPI ref"
            autoComplete="off"
          />
        </label>
        <p className="muted" style={{ margin: "6px 0 0" }}>
          Party booking no. (BK-…) is the main work reference — same number for advance, final payment and report close.
          {partyQuery ? ` Showing ${rows.length} match(es).` : ""}
        </p>
      </div>
      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>Party / booking no.</th>
              <th>Gayatri GST</th>
              <th>Customer GST</th>
              <th>Room number</th>
              <th>Date from</th>
              <th>Date to</th>
              <th>Total amount</th>
              <th>Advance</th>
              <th>Last paid</th>
              <th>Balance</th>
              <th>Settlement</th>
            </tr>
          </thead>
          <tbody>
            {!rows.length && (
              <tr>
                <td colSpan={11} className="muted">
                  {partyQuery ? "No party matches that booking no. / name / phone / ref." : "No active bills."}
                </td>
              </tr>
            )}
            {rows.map(({ b, pays, totals, stay }) => {
              const g = state.guests.find((x) => x.id === b.guestId);
              const { advance, settlement } = ledger(pays, totals);
              const lastPay = pays.filter((p) => p.at).sort((a, c) => String(c.at).localeCompare(String(a.at)))[0];
              return (
                <tr key={b.id} className="clickable" onClick={() => setOpen(b.id)}>
                  <td>
                    {g?.name || "Guest"}
                    <div><strong>{b.number}</strong></div>
                    <div className="muted">{g?.phone || ""}</div>
                  </td>
                  <td>{gstinText(state.property.gstin)}</td>
                  <td>{gstinText(g?.gstin)}</td>
                  <td>{stay.roomLabel}</td>
                  <td>{formatDateDMY(stay.from)}</td>
                  <td>{formatDateDMY(stay.to)}</td>
                  <td>{m(totals.total)}</td>
                  <td>{m(advance)}</td>
                  <td>{lastPay ? formatDateTime(lastPay.at) : "—"}</td>
                  <td>{m(Math.max(0, totals.balance))}</td>
                  <td>{settlement || ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
