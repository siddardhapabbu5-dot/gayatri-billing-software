package com.gayatri.vhms.service;

import com.gayatri.vhms.domain.PermissionKeys;
import com.gayatri.vhms.domain.StaffRole;
import com.gayatri.vhms.entity.AppSetting;
import com.gayatri.vhms.entity.RolePermission;
import com.gayatri.vhms.repository.AppSettingRepository;
import com.gayatri.vhms.repository.RolePermissionRepository;
import com.gayatri.vhms.security.StaffUserDetails;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class PermissionService {
  public static final String SETTING_MANAGER_REFUND_LIMIT = "manager.refund.limit";
  public static final String SETTING_BOOKING_POLICIES = "booking.policies.json";

  private final RolePermissionRepository rolePermissions;
  private final AppSettingRepository settings;

  public PermissionService(RolePermissionRepository rolePermissions, AppSettingRepository settings) {
    this.rolePermissions = rolePermissions;
    this.settings = settings;
  }

  /** Effective permission set for a role (defaults ⊕ DB overrides). */
  @Transactional(readOnly = true)
  public Set<String> effectivePermissions(StaffRole role) {
    Set<String> base = new LinkedHashSet<>(role.getDefaultPermissions());
    if (base.contains(PermissionKeys.ALL)) {
      return Set.of(PermissionKeys.ALL);
    }
    List<RolePermission> overrides = rolePermissions.findByRole(role.name());
    for (RolePermission row : overrides) {
      if (row.isAllowed()) {
        base.add(row.getPermission());
      } else {
        base.remove(row.getPermission());
      }
    }
    // Owner-only keys never stick on non-ADMIN via DB
    if (role != StaffRole.ADMIN) {
      base.removeAll(PermissionKeys.OWNER_ONLY);
    }
    // Account-control keys never stick on Front Desk / Accounts / Housekeeping via DB
    if (role != StaffRole.ADMIN && role != StaffRole.MANAGER) {
      base.removeAll(PermissionKeys.ACCOUNT_CONTROL);
    }
    return CollectionsUnmodifiable(base);
  }

  private static Set<String> CollectionsUnmodifiable(Set<String> base) {
    return java.util.Collections.unmodifiableSet(base);
  }

  public boolean can(StaffUserDetails user, String permission) {
    if (user == null || permission == null) {
      return false;
    }
    Set<String> perms = user.getPermissionKeys();
    if (perms.contains(PermissionKeys.ALL)) {
      return true;
    }
    if (perms.contains(permission)) {
      return true;
    }
    // Page aliases ↔ actions
    return switch (permission) {
      case PermissionKeys.RESERVATIONS ->
          perms.contains(PermissionKeys.BOOKING_CREATE) || perms.contains(PermissionKeys.BOOKING_CANCEL_REQUEST);
      case PermissionKeys.GUESTS ->
          perms.contains(PermissionKeys.GUESTS_VIEW) || perms.contains(PermissionKeys.GUESTS_EDIT);
      case PermissionKeys.BILLING ->
          perms.contains(PermissionKeys.PAYMENT_RECORD)
              || perms.contains(PermissionKeys.INVOICE_ISSUE)
              || perms.contains(PermissionKeys.REFUND_REQUEST);
      case PermissionKeys.REPORTS ->
          perms.contains(PermissionKeys.REPORTS_FINANCE) || perms.contains(PermissionKeys.REPORTS_ALL);
      case PermissionKeys.ROOMS ->
          perms.contains(PermissionKeys.ROOMS_HOUSEKEEPING) || perms.contains(PermissionKeys.ROOMS_STATUS);
      default -> false;
    };
  }

  public void require(StaffUserDetails user, String permission) {
    if (!can(user, permission)) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Missing permission: " + permission);
    }
  }

  @Transactional(readOnly = true)
  public Map<String, Map<String, Boolean>> matrixForRoles() {
    Map<String, Map<String, Boolean>> out = new LinkedHashMap<>();
    for (StaffRole role : StaffRole.values()) {
      Set<String> effective = effectivePermissions(role);
      Map<String, Boolean> row = new LinkedHashMap<>();
      for (String key : PermissionKeys.EDITABLE) {
        boolean on = effective.contains(PermissionKeys.ALL) || effective.contains(key);
        row.put(key, on);
      }
      out.put(role.name(), row);
    }
    return out;
  }

  @Transactional
  public void replaceRolePermissions(StaffRole role, Map<String, Boolean> desired, StaffUserDetails actor) {
    if (actor.getRole() != StaffRole.ADMIN) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the owner can change role permissions");
    }
    if (role == StaffRole.ADMIN) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Owner permissions are fixed");
    }
    rolePermissions.deleteByRole(role.name());
    Set<String> defaults = role.getDefaultPermissions();
    Instant now = Instant.now();
    for (Map.Entry<String, Boolean> e : desired.entrySet()) {
      String key = e.getKey();
      if (!PermissionKeys.EDITABLE.contains(key)
          || PermissionKeys.OWNER_ONLY.contains(key)
          || PermissionKeys.ACCOUNT_CONTROL.contains(key)) {
        continue;
      }
      boolean want = Boolean.TRUE.equals(e.getValue());
      boolean def = defaults.contains(PermissionKeys.ALL) || defaults.contains(key);
      if (want == def) {
        continue; // no override needed
      }
      RolePermission row = new RolePermission();
      row.setRole(role.name());
      row.setPermission(key);
      row.setAllowed(want);
      row.setUpdatedAt(now);
      row.setUpdatedBy(actor.getUser().getId());
      rolePermissions.save(row);
    }
  }

  @Transactional(readOnly = true)
  public BigDecimal managerRefundLimit() {
    return settings.findById(SETTING_MANAGER_REFUND_LIMIT)
        .map(s -> new BigDecimal(s.getValue().trim()))
        .orElse(new BigDecimal("50000"));
  }

  @Transactional
  public void setManagerRefundLimit(BigDecimal amount, StaffUserDetails actor) {
    if (actor.getRole() != StaffRole.ADMIN) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the owner can set the manager refund limit");
    }
    if (amount == null || amount.signum() < 0) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Limit must be zero or positive");
    }
    AppSetting row = settings.findById(SETTING_MANAGER_REFUND_LIMIT).orElseGet(AppSetting::new);
    row.setKey(SETTING_MANAGER_REFUND_LIMIT);
    row.setValue(amount.toPlainString());
    row.setUpdatedAt(Instant.now());
    row.setUpdatedBy(actor.getUser().getId());
    settings.save(row);
  }

  @Transactional(readOnly = true)
  public String bookingPoliciesJson() {
    return settings.findById(SETTING_BOOKING_POLICIES).map(AppSetting::getValue).orElse("{}");
  }

  @Transactional
  public void setBookingPoliciesJson(String json, StaffUserDetails actor) {
    if (actor == null || actor.getRole() != StaffRole.ADMIN) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the owner can edit booking policies");
    }
    if (json == null || json.isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Policies payload required");
    }
    if (json.length() > 200_000) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Policies payload too large");
    }
    AppSetting row = settings.findById(SETTING_BOOKING_POLICIES).orElseGet(AppSetting::new);
    row.setKey(SETTING_BOOKING_POLICIES);
    row.setValue(json.trim());
    row.setUpdatedAt(Instant.now());
    row.setUpdatedBy(actor.getUser().getId());
    settings.save(row);
  }

  @Transactional(readOnly = true)
  public Map<String, String> publicSettings() {
    Map<String, String> out = new LinkedHashMap<>();
    out.put(SETTING_MANAGER_REFUND_LIMIT, managerRefundLimit().toPlainString());
    out.put(SETTING_BOOKING_POLICIES, bookingPoliciesJson());
    return out;
  }
}
