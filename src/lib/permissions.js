/** Shared permission helpers — mirrors backend PermissionKeys / StaffRole defaults. */

export const PERMS = {
  ALL: "*",
  DASHBOARD: "dashboard",
  CALENDAR: "calendar",
  VENUES: "venues",
  ROOMS: "rooms",
  RESERVATIONS: "reservations",
  GUESTS: "guests",
  BILLING: "billing",
  DOCUMENTS: "documents",
  EXPENSES: "expenses",
  VENDORS: "vendors",
  REPORTS: "reports",
  SETTINGS_PROPERTY: "settings.property",
  SETTINGS_ROLES: "settings.roles",
  BOOKING_CREATE: "booking.create",
  BOOKING_CANCEL_REQUEST: "booking.cancel.request",
  BOOKING_CANCEL_APPROVE: "booking.cancel.approve",
  PAYMENT_RECORD: "payment.record",
  INVOICE_ISSUE: "invoice.issue",
  REFUND_REQUEST: "refund.request",
  REFUND_APPROVE: "refund.approve",
  REFUND_PROCESS: "refund.process",
  EXPENSE_CREATE: "expense.create",
  EXPENSE_VERIFY: "expense.verify",
  VENUES_EDIT: "venues.edit",
  PRICES_EDIT: "prices.edit",
  ROOMS_HOUSEKEEPING: "rooms.housekeeping",
  ROOMS_STATUS: "rooms.status",
  GUESTS_VIEW: "guests.view",
  GUESTS_EDIT: "guests.edit",
  REPORTS_FINANCE: "reports.finance",
  REPORTS_ALL: "reports.all",
  USER_CREATE_STAFF: "user.create.staff",
  USER_CREATE_ANY: "user.create.any",
  USER_MANAGE: "user.manage",
  USERS_PERMISSIONS: "users.permissions",
};

const PAGE_ALIASES = {
  reservations: [PERMS.BOOKING_CREATE, PERMS.BOOKING_CANCEL_REQUEST],
  guests: [PERMS.GUESTS_VIEW, PERMS.GUESTS_EDIT],
  billing: [PERMS.PAYMENT_RECORD, PERMS.INVOICE_ISSUE, PERMS.REFUND_REQUEST],
  reports: [PERMS.REPORTS_FINANCE, PERMS.REPORTS_ALL],
  rooms: [PERMS.ROOMS_HOUSEKEEPING, PERMS.ROOMS_STATUS],
};

/** True if the permission list grants `need` (exact, wildcard, or page alias). */
export function canPerm(permissionList, need) {
  const list = Array.isArray(permissionList) ? permissionList : [];
  if (!need) return true;
  if (list.includes(PERMS.ALL) || list.includes(need)) return true;
  const aliases = PAGE_ALIASES[need];
  if (aliases && aliases.some((a) => list.includes(a))) return true;
  return false;
}
