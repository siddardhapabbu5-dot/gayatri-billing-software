package com.gayatri.vhms.domain;

import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;

/**
 * Staff roles with default action + page permissions (matrix baseline).
 * Owner may override non-system keys in PostgreSQL {@code role_permissions}.
 */
public enum StaffRole {
  ADMIN(PermissionKeys.copyOf(PermissionKeys.ALL)),

  MANAGER(PermissionKeys.copyOf(
      PermissionKeys.DASHBOARD, PermissionKeys.CALENDAR, PermissionKeys.VENUES, PermissionKeys.ROOMS,
      PermissionKeys.RESERVATIONS, PermissionKeys.GUESTS, PermissionKeys.BILLING, PermissionKeys.DOCUMENTS,
      PermissionKeys.EXPENSES, PermissionKeys.VENDORS, PermissionKeys.REPORTS, PermissionKeys.SETTINGS_PROPERTY,
      PermissionKeys.BOOKING_CREATE, PermissionKeys.BOOKING_CANCEL_REQUEST, PermissionKeys.BOOKING_CANCEL_APPROVE,
      PermissionKeys.PAYMENT_RECORD, PermissionKeys.INVOICE_ISSUE,
      PermissionKeys.REFUND_REQUEST, PermissionKeys.REFUND_APPROVE, PermissionKeys.REFUND_PROCESS,
      PermissionKeys.EXPENSE_CREATE, PermissionKeys.EXPENSE_VERIFY,
      PermissionKeys.VENUES_EDIT,
      PermissionKeys.ROOMS_HOUSEKEEPING, PermissionKeys.ROOMS_STATUS,
      PermissionKeys.GUESTS_VIEW, PermissionKeys.GUESTS_EDIT,
      PermissionKeys.REPORTS_ALL, PermissionKeys.REPORTS_FINANCE,
      PermissionKeys.USER_CREATE_STAFF, PermissionKeys.USER_MANAGE
  )),

  FRONTDESK(PermissionKeys.copyOf(
      PermissionKeys.DASHBOARD, PermissionKeys.CALENDAR, PermissionKeys.ROOMS, PermissionKeys.RESERVATIONS,
      PermissionKeys.GUESTS, PermissionKeys.BILLING, PermissionKeys.DOCUMENTS, PermissionKeys.EXPENSES,
      PermissionKeys.VENUES,
      PermissionKeys.BOOKING_CREATE, PermissionKeys.BOOKING_CANCEL_REQUEST,
      PermissionKeys.PAYMENT_RECORD, PermissionKeys.INVOICE_ISSUE, PermissionKeys.REFUND_REQUEST,
      PermissionKeys.EXPENSE_CREATE,
      PermissionKeys.GUESTS_VIEW, PermissionKeys.GUESTS_EDIT,
      PermissionKeys.ROOMS_STATUS
  )),

  HOUSEKEEPING(PermissionKeys.copyOf(
      PermissionKeys.CALENDAR, PermissionKeys.ROOMS, PermissionKeys.ROOMS_HOUSEKEEPING
  )),

  ACCOUNTS(PermissionKeys.copyOf(
      PermissionKeys.DASHBOARD, PermissionKeys.CALENDAR, PermissionKeys.BILLING, PermissionKeys.REPORTS,
      PermissionKeys.VENDORS, PermissionKeys.EXPENSES, PermissionKeys.VENUES, PermissionKeys.RESERVATIONS,
      PermissionKeys.GUESTS,
      PermissionKeys.PAYMENT_RECORD, PermissionKeys.INVOICE_ISSUE,
      PermissionKeys.REFUND_REQUEST, PermissionKeys.REFUND_PROCESS,
      PermissionKeys.EXPENSE_CREATE, PermissionKeys.EXPENSE_VERIFY,
      PermissionKeys.GUESTS_VIEW,
      PermissionKeys.REPORTS_FINANCE
  ));

  private final Set<String> permissions;

  StaffRole(Set<String> permissions) {
    this.permissions = Collections.unmodifiableSet(new LinkedHashSet<>(permissions));
  }

  /** Built-in defaults (before DB overrides). */
  public Set<String> getDefaultPermissions() {
    return permissions;
  }

  /** @deprecated prefer {@link #getDefaultPermissions()} — kept for older call sites. */
  public Set<String> getPermissions() {
    return permissions;
  }

  public boolean canDefault(String permission) {
    return permissions.contains(PermissionKeys.ALL) || permissions.contains(permission);
  }

  public String springRole() {
    return "ROLE_" + name();
  }

  public static StaffRole from(String raw) {
    if (raw == null || raw.isBlank()) {
      throw new IllegalArgumentException("Role is required");
    }
    String key = raw.trim().toUpperCase(Locale.ROOT).replace('-', '_');
    if ("ADMINISTRATOR".equals(key) || "OWNER".equals(key)) {
      return ADMIN;
    }
    if ("PROPERTY_MANAGER".equals(key) || "DUTY_MANAGER".equals(key) || "MANAGER".equals(key)) {
      return MANAGER;
    }
    if ("FRONT_DESK".equals(key) || "FRONTDESK".equals(key) || "STAFF".equals(key)) {
      return FRONTDESK;
    }
    return Arrays.stream(values())
        .filter(r -> r.name().equals(key))
        .findFirst()
        .orElseThrow(() -> new IllegalArgumentException("Unknown role: " + raw));
  }
}
