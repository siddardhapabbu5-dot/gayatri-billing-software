package com.gayatri.vhms;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.gayatri.vhms.domain.PermissionKeys;
import com.gayatri.vhms.domain.StaffRole;
import com.gayatri.vhms.entity.AppUser;
import com.gayatri.vhms.security.StaffUserDetails;
import java.util.Set;
import org.junit.jupiter.api.Test;

class PermissionDefaultsTest {

  @Test
  void frontDeskCannotApproveCancelOrRefund() {
    StaffUserDetails d = new StaffUserDetails(user(StaffRole.FRONTDESK), StaffRole.FRONTDESK.getDefaultPermissions());
    assertTrue(d.getPermissionKeys().contains(PermissionKeys.BOOKING_CREATE));
    assertFalse(d.getPermissionKeys().contains(PermissionKeys.BOOKING_CANCEL_APPROVE));
    assertFalse(d.getPermissionKeys().contains(PermissionKeys.REFUND_APPROVE));
    assertFalse(d.getPermissionKeys().contains(PermissionKeys.USERS_PERMISSIONS));
  }

  @Test
  void housekeepingHasNoFinance() {
    Set<String> p = StaffRole.HOUSEKEEPING.getDefaultPermissions();
    assertTrue(p.contains(PermissionKeys.ROOMS_HOUSEKEEPING));
    assertFalse(p.contains(PermissionKeys.PAYMENT_RECORD));
    assertFalse(p.contains(PermissionKeys.GUESTS_EDIT));
  }

  @Test
  void managerCannotChangePermissionsKey() {
    Set<String> p = StaffRole.MANAGER.getDefaultPermissions();
    assertTrue(p.contains(PermissionKeys.USER_CREATE_STAFF));
    assertFalse(p.contains(PermissionKeys.USERS_PERMISSIONS));
    assertFalse(p.contains(PermissionKeys.ALL));
  }

  @Test
  void accountsCanProcessRefundNotApproveByDefault() {
    Set<String> p = StaffRole.ACCOUNTS.getDefaultPermissions();
    assertTrue(p.contains(PermissionKeys.REFUND_PROCESS));
    assertFalse(p.contains(PermissionKeys.REFUND_APPROVE));
    assertTrue(p.contains(PermissionKeys.REPORTS_FINANCE));
  }

  private static AppUser user(StaffRole role) {
    AppUser u = new AppUser();
    u.setEmail(role.name().toLowerCase() + "@test.local");
    u.setFullName(role.name());
    u.setRole(role);
    u.setPasswordHash("x");
    u.setActive(true);
    return u;
  }
}
