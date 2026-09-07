import { useMemo, useState } from "react";
import { bookingFolio, collectionsReport } from "../engine";
import { CHARGE_CATEGORIES, chargeLabel, paymentStatus } from "../finance";
import { downloadCsv, formatDate, formatDateDMY, formatDateTime, gstinText, money, todayISO } from "../lib";
import { TERM_SECTIONS, cancelSectionLines, sectionLines, termSetsOf } from "../policies";
import { PageHead, Pill } from "../ui";

const DOCS = ["Quotation", "Proforma invoice", "Tax invoice", "Advance receipt", "Payment receipt", "Credit note", "Debit note", "Refund receipt", "Final invoice"];
const MODES = ["Cash", "UPI", "Card", "Bank transfer"];

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
  const kind = rooms.length && halls.length ? "mixed" : rooms.length ? "room" : "function";
  return {
    roomLabel: roomNos.length ? roomNos.join(", ") : hallNames[0] || "—",
    from,
    to,
    kind,
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

export default function Billing({ state, focusId, onPay, onDiscount, onCharge, onGstMode, onCancelRoom, onIssue, onClose, onBack, onDocs, backLabel }) {
  const [open, setOpen] = useState(focusId || null);
  const [partyQuery, setPartyQuery] = useState("");
  const [balanceFilter, setBalanceFilter] = useState("all");
  const [kindFilter, setKindFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState("all");
  const booking = state.bookings.find((b) => b.id === open);
  const cur = state.property.currency;
  const loc = state.property.locale;
  const m = (n) => money(n, cur, loc);

  const rows = useMemo(
    () =>
      state.bookings
        .filter((b) => b.status !== "Cancelled")
        .map((b) => ({ b, ...bookingFolio(state, b.id), stay: stayFor(state, b) }))
        .filter(({ b, pays, totals, stay }) => {
          if (!partyMatch(state, b, pays, partyQuery)) return false;
          if (balanceFilter === "due" && !(totals.balance > 0)) return false;
          if (balanceFilter === "settled" && totals.balance > 0) return false;
          if (kindFilter === "hall" && stay.kind === "room") return false;
          if (kindFilter === "room" && stay.kind === "function") return false;
          if (modeFilter !== "all") {
            const modes = pays.map((p) => p.method).filter(Boolean);
            if (!modes.includes(modeFilter)) return false;
          }
          return true;
        }),
    [state, partyQuery, balanceFilter, kindFilter, modeFilter]
  );

  if (booking) {
    const { folio, lines, pays, totals } = bookingFolio(state, booking.id);
    const guest = state.guests.find((g) => g.id === booking.guestId);
    const docs = (state.invoices || []).filter((i) => i.bookingId === booking.id);
    const halls = (state.hallReservations || []).filter((r) => r.bookingId === booking.id);
    const rooms = (state.roomReservations || []).filter((r) => r.bookingId === booking.id);

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
              <div className="muted">{state.property.taxName} {totals.gstMode === "without" ? "· Without GST" : `${totals.taxRate}%`}</div>
              <div className="muted">{state.property.currency} · {state.property.timezone}</div>
            </div>
          </div>
          <div className="orn" />
          <div className="no-print" style={{ marginBottom: 12 }}>
            <label style={{ maxWidth: 280 }}>
              Bill type
              <select
                value={folio?.gstMode === "without" ? "without" : "with"}
                onChange={(e) => folio && onGstMode?.(folio.id, e.target.value)}
              >
                <option value="with">With GST ({state.property.taxPercent}%)</option>
                <option value="without">Without GST</option>
              </select>
            </label>
          </div>
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
                const start = String(h.start || h.date || "").replace("T", " ");
                const end = String(h.end || h.date || "").replace("T", " ");
                return <div key={h.id}>{hall?.name} · {h.slotType} · {start} → {end}</div>;
              })}
              {rooms.map((r) => {
                const room = state.rooms.find((x) => x.id === r.roomId);
                return (
                  <div key={r.id} className="row" style={{ justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                    <div>Room {room?.number} · {r.checkIn} to {r.checkOut}</div>
                    {onCancelRoom && (
                      <button
                        type="button"
                        className="btn danger small no-print"
                        onClick={() => onCancelRoom(r.id)}
                      >
                        Cancel room (no refund)
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <table style={{ marginTop: 16 }}>
            <thead><tr><th>Charge</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
            <tbody>
              {(() => {
                const hallLines = lines.filter((l) => String(l.category || "") === "hall");
                const roomLines = lines.filter((l) => String(l.category || "") === "room");
                const extraLines = lines.filter((l) => {
                  const c = String(l.category || "");
                  return c !== "hall" && c !== "room";
                });
                const sum = (arr) => arr.reduce((s, l) => s + Number(l.amount || 0), 0);
                return (
                  <>
                    {hallLines.length > 0 && (
                      <tr><td colSpan={4}><strong>Hall</strong></td></tr>
                    )}
                    {hallLines.map((l) => (
                      <tr key={l.id}>
                        <td>{l.description}<div className="muted">{chargeLabel(l.category)}</div></td>
                        <td>{l.qty}</td>
                        <td>{m(l.unitPrice)}</td>
                        <td>{m(l.amount)}</td>
                      </tr>
                    ))}
                    {roomLines.length > 0 && (
                      <tr><td colSpan={4}><strong>Room stay</strong></td></tr>
                    )}
                    {roomLines.map((l) => (
                      <tr key={l.id}>
                        <td>{l.description}<div className="muted">{chargeLabel(l.category)}</div></td>
                        <td>{l.qty}</td>
                        <td>{m(l.unitPrice)}</td>
                        <td>{m(l.amount)}</td>
                      </tr>
                    ))}
                    {extraLines.length > 0 && (
                      <tr><td colSpan={4}><strong>Extra charges</strong></td></tr>
                    )}
                    {extraLines.map((l) => (
                      <tr key={l.id}>
                        <td>{l.description}<div className="muted">{chargeLabel(l.category)}</div></td>
                        <td>{l.qty}</td>
                        <td>{m(l.unitPrice)}</td>
                        <td>{m(l.amount)}</td>
                      </tr>
                    ))}
                    {hallLines.length > 0 && (
                      <tr><td colSpan={3}>Hall subtotal</td><td>{m(sum(hallLines))}</td></tr>
                    )}
                    {roomLines.length > 0 && (
                      <tr><td colSpan={3}>Room stay subtotal</td><td>{m(sum(roomLines))}</td></tr>
                    )}
                    {extraLines.length > 0 && (
                      <tr><td colSpan={3}>Extra charges subtotal</td><td>{m(sum(extraLines))}</td></tr>
                    )}
                  </>
                );
              })()}
              <tr><td colSpan={3}>Subtotal</td><td>{m(totals.subtotal)}</td></tr>
              <tr><td colSpan={3}>Discount</td><td>{m(totals.discount)}</td></tr>
              {totals.gstMode === "without" ? (
                <tr><td colSpan={3}>GST</td><td>Without GST · {m(0)}</td></tr>
              ) : (
                <>
                  <tr><td colSpan={3}>Taxable value</td><td>{m(totals.taxable)}</td></tr>
                  <tr><td colSpan={3}>CGST ({(totals.taxRate / 2).toFixed(1)}%)</td><td>{m(totals.cgst)}</td></tr>
                  <tr><td colSpan={3}>SGST ({(totals.taxRate / 2).toFixed(1)}%)</td><td>{m(totals.sgst)}</td></tr>
                  <tr><td colSpan={3}>{state.property.taxName} {totals.taxRate}%</td><td>{m(totals.tax)}</td></tr>
                </>
              )}
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
              const lines =
                sec.id === "cancel"
                  ? cancelSectionLines(state.property, "en")
                  : sectionLines(termSetsOf(state.property).sections[sec.id], state.property);
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
              <div className="muted">Payment status · Remaining amount (balance)</div>
              <strong>{paymentStatus(totals)} · {m(totals.balance)}</strong>
              <p className="muted" style={{ margin: "4px 0 0" }}>
                Total {m(totals.total)} − advance and payments {m(totals.paid)}. Use Payments → Save settlement when the guest pays the rest.
              </p>
            </div>
          ) : (
            <div>
              <div className="muted">Payment status</div>
              <strong>{paymentStatus(totals)} · {m(0)}</strong>
              <p className="muted" style={{ margin: "4px 0 0" }}>Settled. Nothing left to collect.</p>
            </div>
          )}
        </div>
        <div className="panel no-print" style={{ marginTop: 12 }}>
          <h3>Add extra charges</h3>
          <p className="muted" style={{ margin: "0 0 8px" }}>
            Use this for food, tea, laundry, decoration, etc. after the booking is made.
            Click <strong>Add to bill</strong> — it adds a breakup line on the bill above (qty × rate), increases Total / Remaining.
            It does <strong>not</strong> record money received. To collect payment, use <strong>Payments → Save settlement</strong> below.
          </p>
          <form
            className="fields two"
            onSubmit={(e) => {
              e.preventDefault();
              if (!folio || !onCharge) return;
              const fd = new FormData(e.target);
              const category = String(fd.get("category") || "other");
              const qty = Number(fd.get("qty") || 1);
              const unitPrice = Number(fd.get("unitPrice") || 0);
              const description = String(fd.get("description") || "").trim() || chargeLabel(category);
              if (!unitPrice) return;
              onCharge(folio.id, { category, qty, unitPrice, description });
              e.target.reset();
            }}
          >
            <label>
              Charge type
              <select name="category" defaultValue="food">
                {CHARGE_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </label>
            <label>
              Description
              <input name="description" placeholder="Optional note" />
            </label>
            <label>
              Qty
              <input name="qty" type="number" min="1" defaultValue={1} />
            </label>
            <label>
              Rate
              <input name="unitPrice" type="number" min="0" step="1" placeholder="₹" required />
            </label>
            <button className="btn small" type="submit">Add to bill</button>
          </form>
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
      <div className="panel no-print bill-filters" style={{ marginBottom: 12 }}>
        <div className="fields bill-filter-grid">
          <label style={{ gridColumn: "1 / -1" }}>
            Find party
            <input
              type="search"
              value={partyQuery}
              onChange={(e) => setPartyQuery(e.target.value)}
              placeholder="BK-2026-00001 · name · phone · UPI ref"
              autoComplete="off"
            />
          </label>
          <label>
            Balance
            <select value={balanceFilter} onChange={(e) => setBalanceFilter(e.target.value)}>
              <option value="all">All parties</option>
              <option value="due">Balance due</option>
              <option value="settled">Fully settled</option>
            </select>
          </label>
          <label>
            Service
            <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value)}>
              <option value="all">Hall + rooms</option>
              <option value="hall">Hall only</option>
              <option value="room">Room stay only</option>
            </select>
          </label>
          <label>
            Payment mode
            <select value={modeFilter} onChange={(e) => setModeFilter(e.target.value)}>
              <option value="all">Any mode</option>
              {MODES.map((mode) => (
                <option key={mode} value={mode}>{mode}</option>
              ))}
            </select>
          </label>
        </div>
        <p className="muted" style={{ margin: "10px 0 0" }}>
          Click a row to open advance / final payment. Showing {rows.length} party bill{rows.length === 1 ? "" : "s"}.
        </p>
      </div>      <div className="panel">
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
              <th>Status</th>
              <th>GST</th>
              <th>Settlement</th>
            </tr>
          </thead>
          <tbody>
            {!rows.length && (
              <tr>
                <td colSpan={13} className="muted">
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
                  <td>{paymentStatus(totals)}</td>
                  <td>{totals.gstMode === "without" ? "Without GST" : "With GST"}</td>
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
