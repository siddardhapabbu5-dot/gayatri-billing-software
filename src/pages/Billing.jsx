import { useEffect, useMemo, useState } from "react";
import {
  BookingFinanceBar,
  CancelBookingModal,
  PaymentLedgerTable,
  PendingRefundsPanel,
  ProcessRefundModal,
  RefundReceiptView,
} from "../components/CancelRefundDesk";
import { bookingFolio, collectionsReport } from "../engine";
import { CHARGE_CATEGORIES, chargeLabel, paymentStatus } from "../finance";
import { downloadCsv, formatDate, formatDateDMY, formatDateTime, gstinText, money, todayISO } from "../lib";
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

function livePays(pays) {
  return (pays || []).filter((p) => {
    const st = String(p.status || "SUCCESS").toUpperCase();
    return st !== "REVERSED" && st !== "FAILED" && st !== "REJECTED";
  });
}

function sumPayType(pays, type) {
  return livePays(pays)
    .filter((p) => p.type === type)
    .reduce((s, p) => s + Number(p.amount || 0), 0);
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
  const live = (pays || []).filter((p) => {
    const st = String(p.status || "SUCCESS").toUpperCase();
    return st !== "REVERSED" && st !== "FAILED" && st !== "REJECTED";
  });
  const collectRows = live.filter((p) => !["Refund", "Deposit return", "Deposit"].includes(p.type));
  const refundRows = live.filter((p) => p.type === "Refund" || p.type === "Deposit return");
  const advance = collectRows
    .filter((p) => p.type === "Advance")
    .reduce((s, p) => s + Number(p.amount || 0), 0);
  const refunds = refundRows.reduce((s, p) => s + Number(p.amount || 0), 0);
  const collections = collectRows.reduce((s, p) => s + Number(p.amount || 0), 0);
  const paidNet = collections - refunds;

  const sumByMode = (rows) => {
    const map = {};
    for (const p of rows) {
      const mode = String(p.method || "Other").trim() || "Other";
      map[mode] = (map[mode] || 0) + Number(p.amount || 0);
    }
    return map;
  };
  const collectByMode = sumByMode(collectRows);
  const refundByMode = sumByMode(refundRows);

  const methods = Object.keys(collectByMode);
  let settlement = methods.join(", ");
  if (!settlement && refunds > 0) settlement = "Refunded";
  if (!settlement && totals.balance <= 0 && advance > 0) settlement = "Advance";

  return {
    advance,
    refunds,
    collections,
    paidNet,
    settlement,
    collectByMode,
    refundByMode,
    collectRows,
    refundRows,
  };
}

function formatModeAmounts(byMode, m) {
  const entries = Object.entries(byMode || {}).filter(([, v]) => v > 0);
  if (!entries.length) return "—";
  return entries.map(([mode, amt]) => `${mode} ${m(amt)}`).join(" · ");
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

export default function Billing({
  state,
  focusId,
  onPay,
  onDiscount,
  onCharge,
  onGstMode,
  onCancelRoom,
  onIssue,
  onClose,
  onBack,
  onDocs,
  backLabel,
  onCancelBooking,
  onProcessRefund,
  onReversePayment,
  onApproveRefund,
  onRejectRefund,
}) {
  const [open, setOpen] = useState(focusId || null);
  const [partyQuery, setPartyQuery] = useState("");
  const [balanceFilter, setBalanceFilter] = useState("all");
  const [kindFilter, setKindFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState("all");
  const [showCancelled, setShowCancelled] = useState(true);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [receiptId, setReceiptId] = useState(null);
  const booking = state.bookings.find((b) => b.id === open);
  const cur = state.property.currency;
  const loc = state.property.locale;
  const m = (n) => money(n, cur, loc);

  useEffect(() => {
    try {
      const id = sessionStorage.getItem("gayatri-open-cancel");
      if (id && (focusId === id || open === id)) {
        sessionStorage.removeItem("gayatri-open-cancel");
        setCancelOpen(true);
      }
    } catch {
      /* ignore */
    }
  }, [focusId, open]);

  const rows = useMemo(
    () =>
      state.bookings
        .filter((b) => showCancelled || b.status !== "Cancelled")
        .map((b) => ({ b, ...bookingFolio(state, b.id), stay: stayFor(state, b) }))
        .filter(({ b, pays, totals, stay }) => {
          if (!partyMatch(state, b, pays, partyQuery)) return false;
          if (balanceFilter === "due" && !(totals.balance > 0)) return false;
          if (balanceFilter === "refund" && !(totals.balance < 0)) return false;
          if (balanceFilter === "settled" && totals.balance !== 0) return false;
          if (kindFilter === "hall" && stay.kind === "room") return false;
          if (kindFilter === "room" && stay.kind === "function") return false;
          if (modeFilter !== "all") {
            const modes = pays.map((p) => p.method).filter(Boolean);
            if (!modes.includes(modeFilter)) return false;
          }
          return true;
        }),
    [state, partyQuery, balanceFilter, kindFilter, modeFilter, showCancelled]
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
          {booking.status !== "Cancelled" ? (
            <button className="btn danger" type="button" onClick={() => setCancelOpen(true)}>
              Cancel booking
            </button>
          ) : null}
          <button className="btn ghost" type="button" onClick={() => setRefundOpen(true)}>
            Process refund
          </button>
          <button className="btn" onClick={() => window.print()}>Print / PDF</button>
        </PageHead>
        <BookingFinanceBar state={state} bookingId={booking.id} />
        {(state.refunds || []).filter((r) => r.bookingId === booking.id).length > 0 && (
          <div className="panel no-print" style={{ marginBottom: 12 }}>
            <h3>Refund history</h3>
            <table>
              <thead>
                <tr>
                  <th>Refund no</th>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(state.refunds || [])
                  .filter((r) => r.bookingId === booking.id)
                  .map((r) => (
                    <tr key={r.id}>
                      <td>{r.number}</td>
                      <td>{formatDateDMY(r.date || r.createdAt)}</td>
                      <td>{m(r.amount)}</td>
                      <td>{r.status}</td>
                      <td>
                        <button type="button" className="btn ghost small" onClick={() => setReceiptId(r.id)}>
                          Receipt
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
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
              <tr><td colSpan={3}>Advance paid</td><td>{m(sumPayType(pays, "Advance"))}</td></tr>
              <tr><td colSpan={3}>Final payment</td><td>{m(sumPayType(pays, "Final"))}</td></tr>
              <tr><td colSpan={3}>Other collections</td><td>{m(livePays(pays).filter((p) => !["Advance", "Final", "Refund", "Deposit return", "Deposit"].includes(p.type)).reduce((s, p) => s + Number(p.amount || 0), 0))}</td></tr>
              {(() => {
                const L = ledger(pays, totals);
                return (
                  <>
                    <tr>
                      <td colSpan={3}>Customer paid by mode</td>
                      <td>{formatModeAmounts(L.collectByMode, m)}</td>
                    </tr>
                    <tr>
                      <td colSpan={3}>Refund amount</td>
                      <td>{L.refunds > 0 ? m(L.refunds) : "—"}</td>
                    </tr>
                    <tr>
                      <td colSpan={3}>Hotel refund by mode</td>
                      <td>{L.refunds > 0 ? formatModeAmounts(L.refundByMode, m) : "—"}</td>
                    </tr>
                  </>
                );
              })()}
              <tr><td colSpan={3}>Paid (all, net)</td><td>{m(totals.paid)}</td></tr>
              {Number(totals.deposit) > 0 && (
                <tr><td colSpan={3}>Security deposit held</td><td>{m(totals.deposit)}</td></tr>
              )}
              <tr className={totals.balance > 0 ? "due-row" : ""}>
                <td colSpan={3}>
                  <strong>{totals.balance < 0 ? "Guest credit with hotel" : "Remaining to collect"}</strong>
                </td>
                <td>
                  <strong>{totals.balance < 0 ? m(Math.abs(totals.balance)) : m(totals.balance)}</strong>
                  {totals.balance < 0 && (
                    <div className="muted" style={{ fontWeight: 400, fontSize: 12 }}>
                      Received {m(totals.paid)} − bill {m(totals.total)}. Use Refund if returning money.
                    </div>
                  )}
                  {(booking.status === "Cancelled" || booking.status === "Refunded") && (
                    <div className="muted" style={{ fontWeight: 400, fontSize: 12 }}>Booking cancelled — closed</div>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
          {pays.length > 0 && (
            <table style={{ marginTop: 16 }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>In / Out</th>
                  <th>Kind</th>
                  <th>Mode</th>
                  <th>Amount</th>
                  <th>Receipt / Ref</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {[...pays]
                  .sort((a, b) => String(a.at).localeCompare(String(b.at)))
                  .map((p) => {
                    const st = String(p.status || "SUCCESS").toUpperCase();
                    const isOut = p.type === "Refund" || p.type === "Deposit return";
                    return (
                      <tr key={p.id} className={st === "REVERSED" ? "muted" : undefined}>
                        <td>{formatDateTime(p.at)}</td>
                        <td>{isOut ? "Out" : "In"}</td>
                        <td>{payKind(p)}{st === "REVERSED" ? " · reversed" : ""}</td>
                        <td>{p.method || "—"}</td>
                        <td>{m(p.amount)}</td>
                        <td>{[p.receiptNo, p.ref].filter(Boolean).join(" · ") || "—"}</td>
                        <td>{p.notes || "—"}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          )}
        </div>
        <div className={`due-box no-print ${totals.balance > 0 ? "is-due" : "is-paid"}`}>
          {booking.status === "Cancelled" || booking.status === "Refunded" ? (
            <div>
              <div className="muted">Payment status</div>
              <strong>{paymentStatus(totals, booking)} · {m(0)}</strong>
              <p className="muted" style={{ margin: "4px 0 0" }}>
                Booking cancelled. Net paid {m(totals.paid)}. Nothing left to collect.
              </p>
            </div>
          ) : totals.balance > 0 ? (
            <div>
              <div className="muted">Payment status · Remaining amount (balance)</div>
              <strong>{paymentStatus(totals, booking)} · {m(totals.balance)}</strong>
              <p className="muted" style={{ margin: "4px 0 0" }}>
                Total {m(totals.total)} − advance and payments {m(totals.paid)}. Use Payments → Save settlement when the guest pays the rest.
              </p>
            </div>
          ) : totals.balance < 0 ? (
            <div>
              <div className="muted">Payment status · Guest credit</div>
              <strong>{paymentStatus(totals, booking)} · {m(Math.abs(totals.balance))}</strong>
              <p className="muted" style={{ margin: "4px 0 0" }}>
                Bill {m(totals.total)} · received {m(totals.paid)}. Credit is money with hotel after bill dropped (cancel room / discount) — process Refund to return it, or keep as credit.
              </p>
            </div>
          ) : (
            <div>
              <div className="muted">Payment status</div>
              <strong>{paymentStatus(totals, booking)} · {m(0)}</strong>
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
        <PaymentLedgerTable state={state} bookingId={booking.id} onReverse={onReversePayment} />
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
            {folio && totals.balance > 0 ? (
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
                  onClick={() => setRefundOpen(true)}
                >
                  Refund
                </button>
              </form>
            ) : folio ? (
              <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                <span className="muted">Fully paid — settlement form hidden.</span>
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
                <button className="btn danger small" type="button" onClick={() => setRefundOpen(true)}>
                  Refund
                </button>
              </div>
            ) : null}
          </div>
          <div className="panel">
            <h3>Documents</h3>
            {!docs.length && <p className="muted" style={{ margin: 0 }}>No documents issued yet.</p>}
            {docs.map((d) => (
              <div key={d.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
                <span>{d.number}</span>
                <span className="muted">{d.type} · {formatDate(d.at)}</span>
              </div>
            ))}
            <label style={{ display: "block", marginTop: 10 }}>
              <span className="muted">Issue document</span>
              <select
                defaultValue=""
                onChange={(e) => {
                  const t = e.target.value;
                  e.target.value = "";
                  if (t) onIssue(booking.id, t);
                }}
              >
                <option value="" disabled>
                  Choose type…
                </option>
                {DOCS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        {cancelOpen ? (
          <CancelBookingModal
            state={state}
            bookingId={booking.id}
            onClose={() => setCancelOpen(false)}
            onSubmit={(payload) => {
              const out = onCancelBooking?.(booking.id, payload);
              if (out?.error) return out;
              setCancelOpen(false);
              if (out?.refund?.id) setReceiptId(out.refund.id);
              return out;
            }}
          />
        ) : null}
        {refundOpen ? (
          <ProcessRefundModal
            state={state}
            bookingId={booking.id}
            onClose={() => setRefundOpen(false)}
            onSubmit={(payload) => {
              const out = onProcessRefund?.(booking.id, payload);
              if (out?.error) return out;
              setRefundOpen(false);
              if (out?.refund?.id) setReceiptId(out.refund.id);
              return out;
            }}
          />
        ) : null}
        {receiptId ? <RefundReceiptView state={state} refundId={receiptId} onClose={() => setReceiptId(null)} /> : null}
      </>
    );
  }

  return (
    <>
      <PageHead title="Payment & Invoice" sub="Search by party booking no. (BK-…), guest name, phone or UPI/ref. Cancel and refund never delete payment history.">
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
      <PendingRefundsPanel
        state={state}
        onApprove={(id) => onApproveRefund?.(id)}
        onReject={(id) => onRejectRefund?.(id)}
      />
      <div className="panel no-print bill-filters staff-desk-bill-filters" style={{ marginBottom: 12 }}>
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
              <option value="due">To collect</option>
              <option value="refund">To refund</option>
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
          <label className="check">
            <input type="checkbox" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} />
            Show cancelled
          </label>
        </div>
        <p className="muted" style={{ margin: "10px 0 0" }}>
          <strong>Customer paid (mode)</strong> = how guest paid (Cash / UPI / Card / Bank + amount).{" "}
          <strong>Hotel refund (mode)</strong> = refund amount and how hotel returned it.{" "}
          Open the bill for full line register. Showing {rows.length} party bill{rows.length === 1 ? "" : "s"}.
        </p>
      </div>

      {/* Phone card list */}
      <section className="staff-m-bill" aria-label="Phone payments">
        <label className="staff-m-search">
          <span className="sr-only">Find party</span>
          <input
            type="search"
            value={partyQuery}
            onChange={(e) => setPartyQuery(e.target.value)}
            placeholder="Search booking, name, phone…"
            autoComplete="off"
          />
        </label>
        <div className="staff-m-asset-row" role="tablist" aria-label="Balance filter">
          {[
            { id: "all", label: "All" },
            { id: "due", label: "Pending" },
            { id: "refund", label: "Refund" },
            { id: "settled", label: "Settled" },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              className={`staff-m-chip${balanceFilter === f.id ? " on" : ""}`}
              aria-selected={balanceFilter === f.id}
              onClick={() => setBalanceFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        {!rows.length ? (
          <div className="staff-m-empty">
            <p>{partyQuery ? "No matching bills." : "No active bills."}</p>
          </div>
        ) : (
          <div className="staff-m-book-list">
            {rows.map(({ b, pays, totals, stay }) => {
              const g = state.guests.find((x) => x.id === b.guestId);
              const { collections, paidNet } = ledger(pays, totals);
              const bal = Number(totals.balance) || 0;
              const status = paymentStatus(totals, b);
              const tone =
                String(status).toLowerCase().includes("cancel")
                  ? "is-bad"
                  : bal > 0
                    ? "is-warn"
                    : "is-ok";
              return (
                <button
                  key={b.id}
                  type="button"
                  className="staff-m-book-card"
                  onClick={() => setOpen(b.id)}
                >
                  <span className="hall">{stay.roomLabel || "Booking"}</span>
                  <span className="title">{g?.name || "Guest"}</span>
                  <span className="meta">
                    {b.number} · {formatDateDMY(stay.from)}
                    {stay.to && stay.to !== stay.from ? ` → ${formatDateDMY(stay.to)}` : ""}
                  </span>
                  <span className="meta" style={{ fontWeight: 650, color: "#102027", marginTop: 4 }}>
                    {m(totals.total)}
                    {bal > 0 ? ` · pending ${m(bal)}` : collections > 0 ? ` · paid ${m(paidNet)}` : ""}
                  </span>
                  <span className="foot">
                    <span className={`staff-m-status ${tone}`}>{status}</span>
                    <span aria-hidden="true">›</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <div className="panel staff-desk-bill-table">
        <table>
          <thead>
            <tr>
              <th>Party / booking no.</th>
              <th>Gayatri GST</th>
              <th>Customer GST</th>
              <th>Room / hall</th>
              <th>Date from</th>
              <th>Date to</th>
              <th>Total amount</th>
              <th>Collected</th>
              <th>Customer paid (mode)</th>
              <th>Paid (net)</th>
              <th>Advance</th>
              <th>Refund amount</th>
              <th>Hotel refund (mode)</th>
              <th>Last paid</th>
              <th>To collect</th>
              <th>To refund</th>
              <th>Status</th>
              <th>GST</th>
            </tr>
          </thead>
          <tbody>
            {!rows.length && (
              <tr>
                <td colSpan={18} className="muted">
                  {partyQuery ? "No party matches that booking no. / name / phone / ref." : "No active bills."}
                </td>
              </tr>
            )}
            {rows.map(({ b, pays, totals, stay }) => {
              const g = state.guests.find((x) => x.id === b.guestId);
              const { advance, collections, refunds, paidNet, collectByMode, refundByMode } = ledger(pays, totals);
              const lastPay = pays
                .filter((p) => {
                  const st = String(p.status || "SUCCESS").toUpperCase();
                  return p.at && st !== "REVERSED" && st !== "FAILED" && st !== "REJECTED";
                })
                .sort((a, c) => String(c.at).localeCompare(String(a.at)))[0];
              const bal = Number(totals.balance) || 0;
              const toCollect = bal > 0 ? bal : 0;
              const toRefund = bal < 0 ? Math.abs(bal) : 0;
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
                  <td>{m(collections)}</td>
                  <td title="Modes customer used to pay hotel">{formatModeAmounts(collectByMode, m)}</td>
                  <td title={refunds > 0 ? `Collected ${m(collections)} − refunds ${m(refunds)}` : undefined}>
                    {m(paidNet)}
                  </td>
                  <td>{m(advance)}</td>
                  <td>{refunds > 0 ? m(refunds) : "—"}</td>
                  <td title="How hotel returned money to customer">
                    {refunds > 0 ? formatModeAmounts(refundByMode, m) : "—"}
                  </td>
                  <td>{lastPay ? formatDateTime(lastPay.at) : "—"}</td>
                  <td className={toCollect > 0 ? "due-row" : undefined} title={toCollect > 0 ? "Collect from customer" : undefined}>
                    {toCollect > 0 ? m(toCollect) : "—"}
                  </td>
                  <td title={toRefund > 0 ? "Still to return to customer" : undefined}>
                    {toRefund > 0 ? m(toRefund) : "—"}
                  </td>
                  <td>{paymentStatus(totals, b)}</td>
                  <td>{totals.gstMode === "without" ? "Without GST" : "With GST"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
