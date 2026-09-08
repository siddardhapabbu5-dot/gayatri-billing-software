import { bookingFolio } from "./engine";
import { policiesOf } from "./policies";
import { todayISO, parseISO } from "./lib";

/** Configurable cancel tiers — days before event → refund % of net paid. */
export const DEFAULT_CANCEL_TIERS = [
  { id: "t30", minDays: 30, refundPercent: 100, fixedFee: 0, label: "30+ days before" },
  { id: "t15", minDays: 15, refundPercent: 75, fixedFee: 0, label: "15–29 days" },
  { id: "t7", minDays: 7, refundPercent: 50, fixedFee: 0, label: "7–14 days" },
  { id: "t1", minDays: 1, refundPercent: 25, fixedFee: 0, label: "1–6 days" },
  { id: "t0", minDays: 0, refundPercent: 0, fixedFee: 0, label: "Same day / no-show" },
];

export const PAY_METHODS = ["Cash", "UPI", "Card", "Bank transfer", "Other"];

export function cancelTiersOf(property) {
  const pol = policiesOf(property);
  const tiers = Array.isArray(pol.cancelTiers) && pol.cancelTiers.length ? pol.cancelTiers : DEFAULT_CANCEL_TIERS;
  return [...tiers].sort((a, b) => Number(b.minDays) - Number(a.minDays));
}

export function daysUntilEvent(eventDate, asOf = todayISO()) {
  if (!eventDate) return 0;
  const a = parseISO(String(asOf).slice(0, 10));
  const b = parseISO(String(eventDate).slice(0, 10));
  return Math.round((b - a) / 86400000);
}

export function matchCancelTier(property, eventDate, asOf = todayISO()) {
  const days = Math.max(0, daysUntilEvent(eventDate, asOf));
  const tiers = cancelTiersOf(property);
  return tiers.find((t) => days >= Number(t.minDays || 0)) || tiers[tiers.length - 1] || DEFAULT_CANCEL_TIERS.at(-1);
}

export function grossSuccessfulPayments(pays) {
  return (pays || [])
    .filter((p) => !["Refund", "Deposit return", "Deposit"].includes(p.type))
    .filter((p) => {
      const st = String(p.status || "SUCCESS").toUpperCase();
      return st === "SUCCESS" || !p.status;
    })
    .reduce((s, p) => s + Number(p.amount || 0), 0);
}

export function totalRefunds(pays) {
  return (pays || [])
    .filter((p) => p.type === "Refund" || p.type === "Deposit return")
    .filter((p) => {
      const st = String(p.status || "SUCCESS").toUpperCase();
      return st === "SUCCESS" || st === "COMPLETED" || !p.status;
    })
    .reduce((s, p) => s + Number(p.amount || 0), 0);
}

/** Max additional refund = successful payments − previous refunds. */
export function maxRefundable(pays) {
  return Math.max(0, Math.round(grossSuccessfulPayments(pays) - totalRefunds(pays)));
}

/**
 * Suggest cancellation charge + refund from policy tiers (and legacy refundAdvance flag).
 * Balance Due formula stays: Grand Total − Successful Payments + Refunds (via folioTotals).
 */
export function suggestCancelSettlement(state, bookingId, asOf = todayISO()) {
  const booking = (state.bookings || []).find((b) => b.id === bookingId);
  const { totals, pays } = bookingFolio(state, bookingId);
  const pol = policiesOf(state.property);
  const netPaid = maxRefundable(pays);
  const tier = matchCancelTier(state.property, booking?.eventDate || booking?.checkIn, asOf);
  const days = daysUntilEvent(booking?.eventDate || booking?.checkIn, asOf);

  let eligible = netPaid;
  let refundPercent = Number(tier?.refundPercent ?? 0);
  let fixedFee = Number(tier?.fixedFee || 0);

  // Legacy: if refundAdvance is false and no tier override, forfeit all (0% refund).
  if (pol.refundAdvance === false && !(Array.isArray(pol.cancelTiers) && pol.cancelTiers.length)) {
    refundPercent = Math.max(0, 100 - (Number(pol.cancellationPercent) || 100));
  }

  const afterPct = Math.round((eligible * refundPercent) / 100);
  let refundAmount = Math.max(0, afterPct - fixedFee);
  refundAmount = Math.min(refundAmount, netPaid);
  const cancellationCharge = Math.max(0, netPaid - refundAmount);

  return {
    netPaid,
    grossPaid: grossSuccessfulPayments(pays),
    prevRefunds: totalRefunds(pays),
    daysBefore: days,
    tier,
    refundPercent,
    fixedFee,
    cancellationCharge,
    refundAmount,
    totals,
    pays,
    approvalLimit: Number(pol.refundApprovalAbove ?? 5000),
    needsApproval: refundAmount > Number(pol.refundApprovalAbove ?? 5000),
  };
}

/** Final booking financial status from transactions (spec §19). */
export function financialStatus(booking, totals, pays) {
  const status = booking?.status;
  const paid = grossSuccessfulPayments(pays);
  const refunded = totalRefunds(pays);
  const net = paid - refunded;
  const total = Number(totals?.total || 0);
  const balance = Number(totals?.balance || 0);

  if (status === "Cancelled" || status === "Refunded" || totals?.closed) {
    if (refunded <= 0 && paid > 0) return "CANCELLED_NO_REFUND";
    if (refunded > 0 && net <= 0) return "FULLY_REFUNDED";
    if (refunded > 0 && net > 0) return "PARTIALLY_REFUNDED";
    return "CANCELLED_NO_REFUND";
  }
  if (paid <= 0) return "NO_PAYMENT";
  if (balance < 0) return "CREDIT";
  if (balance <= 0) return "PAID";
  if (refunded > 0 && net > 0) return "PARTIALLY_REFUNDED";
  if (paid > 0 && balance > 0) return "PARTIALLY_PAID";
  return "NO_PAYMENT";
}

export function financialStatusLabel(code) {
  const map = {
    NO_PAYMENT: "No payment",
    PARTIALLY_PAID: "Partially paid",
    PAID: "Paid",
    CREDIT: "Guest credit",
    PARTIALLY_REFUNDED: "Partially refunded",
    FULLY_REFUNDED: "Fully refunded",
    CANCELLED_NO_REFUND: "Cancelled · no refund",
  };
  return map[code] || code || "—";
}

/** Invoice-facing status (spec §2). */
export function invoiceStatus(booking, totals, pays, pendingRefund) {
  if (pendingRefund) return "REFUND_PENDING";
  const st = booking?.status;
  if (st === "Cancelled") {
    const refunded = totalRefunds(pays);
    const net = grossSuccessfulPayments(pays) - refunded;
    if (refunded <= 0) return "CANCELLED";
    if (net <= 0) return "REFUNDED";
    return "PARTIALLY_REFUNDED";
  }
  if (st === "Refunded") return "REFUNDED";
  const balance = Number(totals?.balance || 0);
  const paid = Number(totals?.paid || 0);
  if (paid <= 0 && balance > 0) return "DRAFT";
  if (balance <= 0 && paid > 0) return "PAID";
  if (paid > 0 && balance > 0) return "PARTIALLY_PAID";
  return "DRAFT";
}

/** Ledger rows: payments +, refunds − (never mutate originals). */
export function paymentLedger(pays) {
  return [...(pays || [])]
    .sort((a, b) => String(a.at || "").localeCompare(String(b.at || "")))
    .map((p) => {
      const isRefund = p.type === "Refund" || p.type === "Deposit return";
      const amount = Number(p.amount || 0);
      return {
        id: p.id,
        at: p.at,
        type: isRefund ? "Refund" : p.type === "Advance" ? "Payment" : p.type === "Final" ? "Payment" : "Payment",
        kind: p.type || "Payment",
        reference: p.receiptNo || p.ref || p.id,
        amount: isRefund ? -amount : amount,
        method: p.method || "—",
        status: p.status || (isRefund ? "COMPLETED" : "SUCCESS"),
        raw: p,
      };
    });
}

export function billingSummary(totals, pays) {
  const paid = grossSuccessfulPayments(pays);
  const refunded = totalRefunds(pays);
  return {
    grandTotal: Number(totals?.total || 0),
    paid,
    refunded,
    netPaid: paid - refunded,
    balance: Number(totals?.balance || 0),
  };
}

export function canApproveRefunds(user, roles) {
  if (!user) return false;
  const role = roles?.[user.role] || {};
  return user.role === "admin" || user.role === "manager" || role.billing === true;
}
