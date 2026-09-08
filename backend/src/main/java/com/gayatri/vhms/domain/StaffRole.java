package com.gayatri.vhms.domain;

import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;

/**
 * Staff roles aligned with the React desk (src/seed.js ROLES).
 */
public enum StaffRole {
  ADMIN(Set.of("*")),
  MANAGER(Set.of(
      "dashboard", "calendar", "venues", "rooms", "reservations", "guests",
      "events", "catering", "vendors", "billing", "reports", "documents", "expenses", "settings.property"
  )),
  FRONTDESK(Set.of(
      "dashboard", "calendar", "rooms", "reservations", "guests", "billing", "documents", "expenses"
  )),
  HOUSEKEEPING(Set.of("rooms", "calendar")),
  ACCOUNTS(Set.of("dashboard", "billing", "reports", "vendors", "expenses"));

  private final Set<String> permissions;

  StaffRole(Set<String> permissions) {
    this.permissions = Collections.unmodifiableSet(new LinkedHashSet<>(permissions));
  }

  public Set<String> getPermissions() {
    return permissions;
  }

  public boolean can(String permission) {
    return permissions.contains("*") || permissions.contains(permission);
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
    if ("FRONT_DESK".equals(key) || "FRONTDESK".equals(key)) {
      return FRONTDESK;
    }
    return Arrays.stream(values())
        .filter(r -> r.name().equals(key))
        .findFirst()
        .orElseThrow(() -> new IllegalArgumentException("Unknown role: " + raw));
  }
}
