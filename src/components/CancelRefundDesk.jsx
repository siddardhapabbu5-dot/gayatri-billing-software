import { useEffect, useMemo, useState } from "react";
import {
  PAY_METHODS,
  billingSummary,
  financialStatus,
  financialStatusLabel,
  invoiceStatus,
  maxRefundable,
  paymentLedger,
  suggestCancelSettlement,
} from "../billingFinance";
import { bookingFolio } from "../engine";
import { formatDateDMY, formatDateTime, money, todayISO, waMe } from "../lib";
import { Pill } from "../ui";

export function BookingFinanceBar({ state, bookingId }) {
  const { totals, pays } = bookingFolio(state, bookingId);
  const booking = state.bookings.find((b) => b.id === bookingId);
  const sum = billingSummary(totals, pays);
  const fin = financialStatus(booking, totals, pays);
  const inv = invoiceStatus(
    booking,
    totals,
    pays,
    (state.refunds || []).some((r) => r.bookingId === bookingId && r.status === "PENDING")
  );
  const m = (n) => money(n, state.property.currency, state.property.locale);
  return (
    <div className="bill-finance-bar no-print">
      <div>
        <span className="muted">Grand total</span>
        <strong>{m(sum.grandTotal)}</strong>
      </div>
      <div>
        <span className="muted">Paid</span>
        <strong>{m(sum.paid)}</strong>
      </div>
      <div>
        <span className="muted">Refunded</span>
        <strong>{m(sum.refunded)}</strong>
      </div>
      <div>
        <span className="muted">Net paid</span>
        <strong>{m(sum.netPaid)}</strong>
      </div>
      <div>
        <span className="muted">{sum.balance < 0 ? "Guest credit" : "Balance due"}</span>
        <strong>{m(Math.abs(sum.balance))}</strong>
      </div>
      <div>
        <span className="muted">Invoice</span>
        <strong>{inv}</strong>
      </div>
      <div>
        <span className="muted">Financial</span>
        <strong>{financialStatusLabel(fin)}</strong>
      </div>
    </div>
  );
}

export function PaymentLedgerTable({ state, bookingId, onReverse }) {
  const { pays } = bookingFolio(state, bookingId);
  const rows = paymentLedger(pays);
  const m = (n) => money(Math.abs(n), state.property.currency, state.property.locale);
  const liveRows = rows.filter((r) => String(r.status).toUpperCase() !== "REVERSED");
  const net = liveRows.reduce((s, r) => s + r.amount, 0);
  return (
    <div className="panel no-print" style={{ marginTop: 12 }}>
      <h3>Payment history (ledger)</h3>
      <p className="muted" style={{ marginTop: 0 }}>
        Original payments are never deleted. If a refund was posted twice by mistake, use <strong>Reverse</strong> on the extra refund line.
      </p>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Reference</th>
            <th className="num">Amount</th>
            <th>Method</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {!rows.length && (
            <tr>
              <td colSpan={7} className="muted">
                No payments yet.
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={r.id} style={{ opacity: String(r.status).toUpperCase() === "REVERSED" ? 0.55 : 1 }}>
              <td>{r.at ? formatDateTime(r.at) : "—"}</td>
              <td>{r.kind}</td>
              <td>{r.reference}</td>
              <td className="num" style={{ color: r.amount < 0 ? "var(--due)" : "inherit" }}>
                {r.amount < 0 ? `−${m(r.amount)}` : `+${m(r.amount)}`}
              </td>
              <td>{r.method}</td>
              <td>{r.status}</td>
              <td>
                {String(r.status).toUpperCase() !== "REVERSED" && r.kind === "Refund" && onReverse ? (
                  <button
                    type="button"
                    className="btn ghost small"
                    onClick={() => {
                      const why = window.prompt("Reason to reverse this refund (keeps audit history):", "Duplicate refund");
                      if (why === null) return;
                      onReverse(r.id, why);
                    }}
                  >
                    Reverse
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
          {liveRows.length > 0 && (
            <tr>
              <td colSpan={3}>
                <strong>Net (live)</strong>
              </td>
              <td className="num">
                <strong>
                  {net < 0 ? "−" : "+"}
                  {m(net)}
                </strong>
              </td>
              <td colSpan={3} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function CancelBookingModal({ state, bookingId, onClose, onSubmit }) {
  const booking = state.bookings.find((b) => b.id === bookingId);
  const guest = state.guests.find((g) => g.id === booking?.guestId);
  const suggestion = useMemo(() => suggestCancelSettlement(state, bookingId), [state, bookingId]);
  const [reason, setReason] = useState("");
  const [cancelDate, setCancelDate] = useState(todayISO());
  const [charge, setCharge] = useState(suggestion.cancellationCharge);
  const [refundAmount, setRefundAmount] = useState(suggestion.refundAmount);
  const [method, setMethod] = useState("Bank transfer");
  const [ref, setRef] = useState("");
  const [notes, setNotes] = useState("");
  const [override, setOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [error, setError] = useState("");
  const m = (n) => money(n, state.property.currency, state.property.locale);

  useEffect(() => {
    const s = suggestCancelSettlement(state, bookingId, cancelDate);
    setCharge(s.cancellationCharge);
    setRefundAmount(s.refundAmount);
  }, [state, bookingId, cancelDate]);

  if (!booking) return null;

  function applyPolicy() {
    const s = suggestCancelSettlement(state, bookingId, cancelDate);
    setCharge(s.cancellationCharge);
    setRefundAmount(s.refundAmount);
    setOverride(false);
  }

  function save() {
    setError("");
    if (!reason.trim()) {
      setError("Cancellation reason is required.");
      return;
    }
    if (override && !overrideReason.trim()) {
      setError("Policy override requires a reason.");
      return;
    }
    const maxRf = maxRefundable(suggestion.pays);
    if (Number(refundAmount) > maxRf) {
      setError(`Refund cannot exceed net paid (${m(maxRf)}).`);
      return;
    }
    const out = onSubmit?.({
      reason: reason.trim(),
      cancelDate,
      cancellationCharge: Number(charge) || 0,
      refundAmount: Number(refundAmount) || 0,
      refundMethod: method,
      refundRef: ref.trim(),
      notes: notes.trim(),
      policyOverride: override,
      overrideReason: overrideReason.trim(),
    });
    if (out?.error) setError(out.error);
  }

  return (
    <div className="cancel-detail-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="panel cancel-detail-card" style={{ width: "min(720px, 100%)" }} onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <h3>Cancel booking · {booking.number}</h3>
          <button type="button" className="btn ghost small" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <p className="muted">
          {guest?.name} · {guest?.phone} · Event {formatDateDMY(booking.eventDate)}. Inventory will be released. Payments are kept;
          refunds are posted as separate transactions.
        </p>
        <div className="cancel-detail-grid">
          <div>
            <div className="muted">Net paid (refundable)</div>
            <strong>{m(suggestion.netPaid)}</strong>
          </div>
          <div>
            <div className="muted">Policy tier</div>
            <strong>
              {suggestion.tier?.label || "—"} · {suggestion.refundPercent}% · {suggestion.daysBefore}d
            </strong>
          </div>
          <div>
            <div className="muted">Suggested charge</div>
            <strong>{m(suggestion.cancellationCharge)}</strong>
          </div>
          <div>
            <div className="muted">Suggested refund</div>
            <strong>{m(suggestion.refundAmount)}</strong>
          </div>
        </div>
        <div className="fields two">
          <label>
            Cancellation reason *
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Guest request, date change…" />
          </label>
          <label>
            Cancellation date
            <input type="date" value={cancelDate} onChange={(e) => setCancelDate(e.target.value || todayISO())} />
          </label>
          <label>
            Cancellation charge
            <input type="number" min="0" value={charge} onChange={(e) => setCharge(e.target.value)} />
          </label>
          <label>
            Refund amount
            <input type="number" min="0" max={suggestion.netPaid} value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} />
          </label>
          <label>
            Refund method
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              {PAY_METHODS.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </label>
          <label>
            Refund reference / UTR
            <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="UTR / cheque no." />
          </label>
          <label className="check" style={{ gridColumn: "1 / -1" }}>
            <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} /> Override policy amounts
          </label>
          {override ? (
            <label style={{ gridColumn: "1 / -1" }}>
              Override reason *
              <input value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} />
            </label>
          ) : null}
          <label style={{ gridColumn: "1 / -1" }}>
            Notes
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
        </div>
        {suggestion.needsApproval && Number(refundAmount) > suggestion.approvalLimit ? (
          <p className="muted">
            Refund above {m(suggestion.approvalLimit)} may need manager approval if you are not admin/manager.
          </p>
        ) : null}
        {error ? <p style={{ color: "var(--due)" }}>{error}</p> : null}
        <div className="row" style={{ gap: 8, marginTop: 12 }}>
          <button type="button" className="btn ghost" onClick={applyPolicy}>
            Reset to policy
          </button>
          <button type="button" className="btn danger" onClick={save}>
            Confirm cancel
          </button>
          <button type="button" className="btn ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function ProcessRefundModal({ state, bookingId, onClose, onSubmit }) {
  const booking = state.bookings.find((b) => b.id === bookingId);
  const { pays } = bookingFolio(state, bookingId);
  const maxRf = maxRefundable(pays);
  const [amount, setAmount] = useState(maxRf);
  const [method, setMethod] = useState("UPI");
  const [ref, setRef] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(todayISO());
  const [error, setError] = useState("");
  const m = (n) => money(n, state.property.currency, state.property.locale);

  function save() {
    setError("");
    const out = onSubmit?.({
      amount: Number(amount) || 0,
      method,
      ref: ref.trim(),
      reason: reason.trim() || "Refund",
      notes: notes.trim(),
      date,
    });
    if (out?.error) setError(out.error);
  }

  if (!booking) return null;
  return (
    <div className="cancel-detail-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="panel cancel-detail-card" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <h3>Process refund · {booking.number}</h3>
          <button type="button" className="btn ghost small" onClick={onClose}>
            ×
          </button>
        </div>
        <p className="muted">Max additional refund: {m(maxRf)}. Original payments are not edited.</p>
        <div className="fields two">
          <label>
            Refund amount
            <input type="number" min="1" max={maxRf} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <label>
            Date
            <input type="date" value={date} onChange={(e) => setDate(e.target.value || todayISO())} />
          </label>
          <label>
            Method
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              {PAY_METHODS.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </label>
          <label>
            UTR / reference
            <input value={ref} onChange={(e) => setRef(e.target.value)} />
          </label>
          <label style={{ gridColumn: "1 / -1" }}>
            Reason
            <input value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          <label style={{ gridColumn: "1 / -1" }}>
            Notes
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
        </div>
        {error ? <p style={{ color: "var(--due)" }}>{error}</p> : null}
        <div className="row" style={{ gap: 8, marginTop: 12 }}>
          <button type="button" className="btn" onClick={save}>
            Post refund
          </button>
          <button type="button" className="btn ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function RefundReceiptView({ state, refundId, onClose }) {
  const refund = (state.refunds || []).find((r) => r.id === refundId);
  const booking = state.bookings.find((b) => b.id === refund?.bookingId);
  const guest = state.guests.find((g) => g.id === refund?.customerId || g.id === booking?.guestId);
  const { totals, pays } = booking ? bookingFolio(state, booking.id) : { totals: {}, pays: [] };
  const paid = pays.filter((p) => !["Refund", "Deposit return"].includes(p.type)).reduce((s, p) => s + Number(p.amount || 0), 0);
  const m = (n) => money(n, state.property.currency, state.property.locale);
  if (!refund || !booking) return null;

  const hall = (state.hallReservations || []).find((r) => r.bookingId === booking.id);
  const hallName = state.halls.find((h) => h.id === hall?.hallId)?.name;

  return (
    <div className="cancel-detail-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="panel cancel-detail-card refund-receipt-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head no-print">
          <h3>Refund receipt</h3>
          <div className="row" style={{ gap: 6 }}>
            <button type="button" className="btn" onClick={() => window.print()}>
              Print / PDF
            </button>
            {guest?.phone ? (
              <a
                className="btn ghost"
                href={waMe(
                  guest.phone,
                  `${state.property.name}: Refund ${refund.number} of ${m(refund.amount)} for ${booking.number} processed.`
                )}
                target="_blank"
                rel="noreferrer"
              >
                Share
              </a>
            ) : null}
            <button type="button" className="btn ghost" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
        <div className="refund-receipt-print">
          <h2 style={{ margin: "0 0 4px", textAlign: "center" }}>{state.property.name}</h2>
          <p className="muted" style={{ textAlign: "center", marginTop: 0 }}>
            REFUND RECEIPT
          </p>
          <div className="cancel-detail-grid">
            <div>
              <div className="muted">Refund no</div>
              <strong>{refund.number}</strong>
            </div>
            <div>
              <div className="muted">Date</div>
              <strong>{formatDateDMY(refund.date || refund.createdAt)}</strong>
            </div>
            <div>
              <div className="muted">Customer</div>
              <strong>{guest?.name || "—"}</strong>
              <div className="muted">{guest?.phone}</div>
            </div>
            <div>
              <div className="muted">Booking</div>
              <strong>
                {hallName || booking.type} · {booking.number}
              </strong>
            </div>
            <div>
              <div className="muted">Amount paid (gross)</div>
              <strong>{m(paid)}</strong>
            </div>
            <div>
              <div className="muted">Cancellation charge</div>
              <strong>{m(refund.cancellationCharge || 0)}</strong>
            </div>
            <div>
              <div className="muted">Refund amount</div>
              <strong>{m(refund.amount)}</strong>
            </div>
            <div>
              <div className="muted">Method</div>
              <strong>{refund.method}</strong>
            </div>
            <div>
              <div className="muted">UTR / reference</div>
              <strong>{refund.ref || refund.receiptNo || "—"}</strong>
            </div>
            <div>
              <div className="muted">Status</div>
              <Pill status={refund.status === "COMPLETED" ? "Paid" : refund.status}>{refund.status}</Pill>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <div className="muted">Reason</div>
              <strong>{refund.reason || "—"}</strong>
            </div>
            <div>
              <div className="muted">Processed by</div>
              <strong>{refund.processedBy || "—"}</strong>
            </div>
            <div>
              <div className="muted">Approved by</div>
              <strong>{refund.approvedBy || "—"}</strong>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 48, gap: 24 }}>
            <div>
              <div>Customer signature</div>
              <div style={{ borderBottom: "1px solid #999", width: 200, height: 36 }} />
            </div>
            <div>
              <div>Authorized signature</div>
              <div style={{ borderBottom: "1px solid #999", width: 200, height: 36 }} />
            </div>
          </div>
          <p className="muted" style={{ marginTop: 16, fontSize: 12 }}>
            Invoice total on file {m(totals.total)}. This receipt does not alter historical payment lines.
          </p>
        </div>
      </div>
    </div>
  );
}

export function PendingRefundsPanel({ state, onApprove, onReject }) {
  const pending = (state.refunds || []).filter((r) => r.status === "PENDING");
  if (!pending.length) return null;
  const m = (n) => money(n, state.property.currency, state.property.locale);
  return (
    <div className="panel no-print" style={{ marginBottom: 12 }}>
      <h3>Refunds awaiting approval</h3>
      <table>
        <thead>
          <tr>
            <th>Refund</th>
            <th>Booking</th>
            <th>Amount</th>
            <th>By</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {pending.map((r) => (
            <tr key={r.id}>
              <td>{r.number}</td>
              <td>{state.bookings.find((b) => b.id === r.bookingId)?.number}</td>
              <td>{m(r.amount)}</td>
              <td>{r.processedBy}</td>
              <td className="row">
                <button type="button" className="btn small" onClick={() => onApprove?.(r.id)}>
                  Approve
                </button>
                <button type="button" className="btn danger small" onClick={() => onReject?.(r.id)}>
                  Reject
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
