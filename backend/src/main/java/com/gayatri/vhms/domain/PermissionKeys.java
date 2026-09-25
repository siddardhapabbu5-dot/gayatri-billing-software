package com.gayatri.vhms.domain;

import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Canonical permission keys. Page keys keep nav working; action keys gate API writes.
 * Spring authority = PERM_ + key with '.' → '_' uppercased (booking.create → PERM_BOOKING_CREATE).
 */
public final class PermissionKeys {
  private PermissionKeys() {}

  public static final String ALL = "*";

  // Pages / read surfaces
  public static final String DASHBOARD = "dashboard";
  public static final String CALENDAR = "calendar";
  public static final String VENUES = "venues";
  public static final String ROOMS = "rooms";
  public static final String RESERVATIONS = "reservations";
  public static final String GUESTS = "guests";
  public static final String BILLING = "billing";
  public static final String DOCUMENTS = "documents";
  public static final String EXPENSES = "expenses";
  public static final String VENDORS = "vendors";
  public static final String REPORTS = "reports";
  public static final String SETTINGS_PROPERTY = "settings.property";
  public static final String SETTINGS_ROLES = "settings.roles";

  // Actions
  public static final String BOOKING_CREATE = "booking.create";
  public static final String BOOKING_CANCEL_REQUEST = "booking.cancel.request";
  public static final String BOOKING_CANCEL_APPROVE = "booking.cancel.approve";
  public static final String PAYMENT_RECORD = "payment.record";
  public static final String INVOICE_ISSUE = "invoice.issue";
  public static final String REFUND_REQUEST = "refund.request";
  public static final String REFUND_APPROVE = "refund.approve";
  public static final String REFUND_PROCESS = "refund.process";
  public static final String EXPENSE_CREATE = "expense.create";
  public static final String EXPENSE_VERIFY = "expense.verify";
  public static final String VENUES_EDIT = "venues.edit";
  public static final String PRICES_EDIT = "prices.edit";
  public static final String ROOMS_HOUSEKEEPING = "rooms.housekeeping";
  public static final String ROOMS_STATUS = "rooms.status";
  public static final String GUESTS_VIEW = "guests.view";
  public static final String GUESTS_EDIT = "guests.edit";
  public static final String REPORTS_FINANCE = "reports.finance";
  public static final String REPORTS_ALL = "reports.all";
  public static final String USER_CREATE_STAFF = "user.create.staff";
  public static final String USER_CREATE_ANY = "user.create.any";
  public static final String USER_MANAGE = "user.manage";
  public static final String USERS_PERMISSIONS = "users.permissions";

  /** Catalog shown on Owner Roles & Permissions screen (editable day-to-day keys). */
  public static final List<String> EDITABLE = List.of(
      DASHBOARD, CALENDAR, VENUES, ROOMS, RESERVATIONS, GUESTS, BILLING, DOCUMENTS, EXPENSES, VENDORS,
      REPORTS, SETTINGS_PROPERTY,
      BOOKING_CREATE, BOOKING_CANCEL_REQUEST, BOOKING_CANCEL_APPROVE,
      PAYMENT_RECORD, INVOICE_ISSUE,
      REFUND_REQUEST, REFUND_APPROVE, REFUND_PROCESS,
      EXPENSE_CREATE, EXPENSE_VERIFY,
      VENUES_EDIT, PRICES_EDIT,
      ROOMS_HOUSEKEEPING, ROOMS_STATUS,
      GUESTS_VIEW, GUESTS_EDIT,
      REPORTS_FINANCE, REPORTS_ALL,
      USER_CREATE_STAFF, USER_MANAGE
  );

  /** Never grant via UI to non-Owner; Owner-only system keys. */
  public static final Set<String> OWNER_ONLY = Set.of(
      USERS_PERMISSIONS, USER_CREATE_ANY, SETTINGS_ROLES, ALL
  );

  public static String toAuthority(String permission) {
    if (ALL.equals(permission)) {
      return "PERM_ALL";
    }
    return "PERM_" + permission.replace('.', '_').toUpperCase();
  }

  public static Set<String> copyOf(String... keys) {
    return Collections.unmodifiableSet(new LinkedHashSet<>(Arrays.asList(keys)));
  }
}
