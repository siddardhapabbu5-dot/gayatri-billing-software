/**
 * RBAC regression: frontend permission helpers match the Owner/Manager/Staff matrix.
 */
import assert from "node:assert/strict";
import { canPerm, PERMS } from "../src/lib/permissions.js";

const FRONTDESK = [
  "dashboard", "calendar", "rooms", "reservations", "guests", "billing", "documents", "expenses", "venues",
  "booking.create", "booking.cancel.request", "payment.record", "invoice.issue", "refund.request",
  "expense.create", "guests.view", "guests.edit", "rooms.status",
];
const MANAGER = [
  "booking.create", "booking.cancel.approve", "refund.approve", "user.create.staff", "user.manage",
];
const HOUSEKEEPING = ["calendar", "rooms", "rooms.housekeeping"];
const ACCOUNTS = ["refund.process", "reports.finance", "expense.verify"];

assert.ok(PERMS.BOOKING_CREATE === "booking.create");
assert.equal(canPerm(["*"], "anything"), true);
assert.equal(canPerm(FRONTDESK, PERMS.BOOKING_CREATE), true);
assert.equal(canPerm(FRONTDESK, PERMS.BOOKING_CANCEL_APPROVE), false);
assert.equal(canPerm(FRONTDESK, PERMS.REFUND_APPROVE), false);
assert.equal(canPerm(MANAGER, PERMS.BOOKING_CANCEL_APPROVE), true);
assert.equal(canPerm(MANAGER, PERMS.USERS_PERMISSIONS), false);
assert.equal(canPerm(HOUSEKEEPING, PERMS.PAYMENT_RECORD), false);
assert.equal(canPerm(HOUSEKEEPING, PERMS.ROOMS_HOUSEKEEPING), true);
assert.equal(canPerm(HOUSEKEEPING, PERMS.GUESTS_EDIT), false);
assert.equal(canPerm(ACCOUNTS, PERMS.REPORTS_FINANCE), true);
assert.equal(canPerm(ACCOUNTS, PERMS.REFUND_APPROVE), false);
assert.equal(canPerm(["payment.record"], "billing"), true);
assert.equal(canPerm(["reports.finance"], "reports"), true);
assert.equal(canPerm(["rooms.housekeeping"], "rooms"), true);

console.log("ok: RBAC permission matrix helpers");
