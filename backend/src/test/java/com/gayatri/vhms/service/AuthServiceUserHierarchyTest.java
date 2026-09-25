package com.gayatri.vhms.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.gayatri.vhms.config.JwtProperties;
import com.gayatri.vhms.domain.PermissionKeys;
import com.gayatri.vhms.domain.StaffRole;
import com.gayatri.vhms.dto.AuthDtos.CreateUserRequest;
import com.gayatri.vhms.dto.AuthDtos.UpdateUserRequest;
import com.gayatri.vhms.dto.AuthDtos.UserResponse;
import com.gayatri.vhms.entity.AppUser;
import com.gayatri.vhms.repository.AppUserRepository;
import com.gayatri.vhms.security.JwtService;
import com.gayatri.vhms.security.StaffUserDetails;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

/**
 * Hard hierarchy for account control — independent of editable user.manage toggles.
 */
@ExtendWith(MockitoExtension.class)
class AuthServiceUserHierarchyTest {

  @Mock AuthenticationManager authManager;
  @Mock JwtService jwtService;
  @Mock JwtProperties jwtProperties;
  @Mock AppUserRepository users;
  @Mock PasswordEncoder encoder;
  @Mock PermissionService permissions;
  @Mock AuditService audit;

  AuthService auth;

  @BeforeEach
  void setUp() {
    auth = new AuthService(authManager, jwtService, jwtProperties, users, encoder, permissions, audit);
  }

  @Test
  void managerCreateFrontDeskSucceeds() {
    StaffUserDetails manager = principal(StaffRole.MANAGER);
    when(users.existsByEmailIgnoreCase("desk@test.local")).thenReturn(false);
    when(encoder.encode(any())).thenReturn("hash");
    when(permissions.effectivePermissions(StaffRole.FRONTDESK)).thenReturn(Set.of("billing"));
    when(users.save(any(AppUser.class))).thenAnswer(inv -> {
      AppUser u = inv.getArgument(0);
      u.setId(42L);
      return u;
    });

    UserResponse out = auth.createUser(
        new CreateUserRequest("desk@test.local", "Password1!", "Desk", "FRONTDESK"),
        manager
    );

    assertEquals(StaffRole.FRONTDESK, out.role());
    assertEquals("desk@test.local", out.email());
  }

  @Test
  void managerCannotCreateManagerAccountsOwnerOrHousekeeping() {
    StaffUserDetails manager = principal(StaffRole.MANAGER);
    for (String role : new String[] {"MANAGER", "ADMIN", "ACCOUNTS", "HOUSEKEEPING"}) {
      ResponseStatusException ex = assertThrows(
          ResponseStatusException.class,
          () -> auth.createUser(
              new CreateUserRequest("x@test.local", "Password1!", "X", role),
              manager
          )
      );
      assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
    }
    verify(users, never()).save(any());
  }

  @Test
  void managerCannotResetOwnerPasswordOrDeactivate() {
    StaffUserDetails manager = principal(StaffRole.MANAGER);
    AppUser owner = stored(1L, "owner@test.local", StaffRole.ADMIN);
    when(users.findById(1L)).thenReturn(Optional.of(owner));

    ResponseStatusException ex = assertThrows(
        ResponseStatusException.class,
        () -> auth.updateUser(
            1L,
            new UpdateUserRequest(null, null, false, "HackedPass9"),
            manager
        )
    );
    assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
    assertTrue(ex.getReason().contains("Owner"));
    verify(users, never()).save(any());
  }

  @Test
  void managerCannotTouchAnotherManager() {
    StaffUserDetails manager = principal(StaffRole.MANAGER);
    AppUser other = stored(3L, "mgr2@test.local", StaffRole.MANAGER);
    when(users.findById(3L)).thenReturn(Optional.of(other));

    ResponseStatusException ex = assertThrows(
        ResponseStatusException.class,
        () -> auth.updateUser(3L, new UpdateUserRequest("New Name", null, null, null), manager)
    );
    assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
  }

  @Test
  void managerCannotPromoteStaffToAccounts() {
    StaffUserDetails manager = principal(StaffRole.MANAGER);
    AppUser staff = stored(10L, "staff@test.local", StaffRole.FRONTDESK);
    when(users.findById(10L)).thenReturn(Optional.of(staff));

    ResponseStatusException ex = assertThrows(
        ResponseStatusException.class,
        () -> auth.updateUser(10L, new UpdateUserRequest(null, "ACCOUNTS", null, null), manager)
    );
    assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
  }

  @Test
  void managerCanDeactivateFrontDeskStaff() {
    StaffUserDetails manager = principal(StaffRole.MANAGER);
    AppUser staff = stored(10L, "staff@test.local", StaffRole.FRONTDESK);
    when(users.findById(10L)).thenReturn(Optional.of(staff));
    when(permissions.effectivePermissions(StaffRole.FRONTDESK)).thenReturn(Set.of("billing"));
    when(users.save(any(AppUser.class))).thenAnswer(inv -> inv.getArgument(0));

    UserResponse out = auth.updateUser(10L, new UpdateUserRequest(null, null, false, null), manager);
    assertEquals(false, out.active());
  }

  @Test
  void frontdeskWithForgedUserManageStillCannotCreate() {
    // Even if permission toggles wrongly included user.manage, actor role wins.
    AppUser desk = stored(5L, "desk@test.local", StaffRole.FRONTDESK);
    StaffUserDetails forged = new StaffUserDetails(
        desk,
        Set.of(PermissionKeys.USER_MANAGE, PermissionKeys.USER_CREATE_STAFF, PermissionKeys.USER_CREATE_ANY)
    );

    ResponseStatusException ex = assertThrows(
        ResponseStatusException.class,
        () -> auth.createUser(
            new CreateUserRequest("n@test.local", "Password1!", "N", "FRONTDESK"),
            forged
        )
    );
    assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
  }

  @Test
  void ownerCanCreateManagerAndLastOwnerProtected() {
    StaffUserDetails owner = principal(StaffRole.ADMIN);
    when(users.existsByEmailIgnoreCase("mgr@test.local")).thenReturn(false);
    when(encoder.encode(any())).thenReturn("hash");
    when(permissions.effectivePermissions(StaffRole.MANAGER)).thenReturn(Set.of("user.manage"));
    when(users.save(any(AppUser.class))).thenAnswer(inv -> {
      AppUser u = inv.getArgument(0);
      u.setId(7L);
      return u;
    });

    UserResponse created = auth.createUser(
        new CreateUserRequest("mgr@test.local", "Password1!", "Mgr", "MANAGER"),
        owner
    );
    assertEquals(StaffRole.MANAGER, created.role());

    AppUser soleOwner = stored(1L, "owner@test.local", StaffRole.ADMIN);
    when(users.findById(1L)).thenReturn(Optional.of(soleOwner));
    when(users.countByRoleAndActiveTrueAndRemovedAtIsNull(StaffRole.ADMIN)).thenReturn(1L);

    ResponseStatusException ex = assertThrows(
        ResponseStatusException.class,
        () -> auth.updateUser(1L, new UpdateUserRequest(null, null, false, null), owner)
    );
    assertEquals(HttpStatus.CONFLICT, ex.getStatusCode());
  }

  @Test
  void managerCanRemoveFrontDeskButNotManager() {
    StaffUserDetails manager = principal(StaffRole.MANAGER);
    AppUser staff = stored(10L, "staff@test.local", StaffRole.FRONTDESK);
    when(users.findById(10L)).thenReturn(Optional.of(staff));
    when(permissions.effectivePermissions(StaffRole.FRONTDESK)).thenReturn(Set.of("billing"));
    when(users.save(any(AppUser.class))).thenAnswer(inv -> inv.getArgument(0));

    UserResponse out = auth.removeUser(10L, manager);
    assertEquals(true, out.removed());
    assertEquals(false, out.active());

    AppUser otherMgr = stored(3L, "mgr2@test.local", StaffRole.MANAGER);
    when(users.findById(3L)).thenReturn(Optional.of(otherMgr));
    ResponseStatusException ex = assertThrows(
        ResponseStatusException.class,
        () -> auth.removeUser(3L, manager)
    );
    assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
  }

  @Test
  void cannotRemoveLastActiveOwner() {
    AppUser actor = stored(2L, "owner2@test.local", StaffRole.ADMIN);
    StaffUserDetails owner = new StaffUserDetails(actor);
    AppUser sole = stored(1L, "owner@test.local", StaffRole.ADMIN);
    when(users.findById(1L)).thenReturn(Optional.of(sole));
    when(users.countByRoleAndActiveTrueAndRemovedAtIsNull(StaffRole.ADMIN)).thenReturn(1L);

    ResponseStatusException ex = assertThrows(
        ResponseStatusException.class,
        () -> auth.removeUser(1L, owner)
    );
    assertEquals(HttpStatus.CONFLICT, ex.getStatusCode());
  }

  @Test
  void legacyInactiveDemoEmailsAreHiddenFromNormalList() {
    AppUser demo = stored(8L, "desk@gayatrifunctionhall.com", StaffRole.FRONTDESK);
    demo.setActive(false);
    assertTrue(AuthService.isLegacyHiddenDemo(demo));
    AppUser live = stored(9L, "desk@gayatri.local", StaffRole.FRONTDESK);
    assertTrue(!AuthService.isLegacyHiddenDemo(live));
  }

  @Test
  void accountControlKeysAreNotInEditableCatalog() {
    assertTrue(!PermissionKeys.EDITABLE.contains(PermissionKeys.USER_MANAGE));
    assertTrue(!PermissionKeys.EDITABLE.contains(PermissionKeys.USER_CREATE_STAFF));
    assertTrue(PermissionKeys.ACCOUNT_CONTROL.contains(PermissionKeys.USER_MANAGE));
  }

  private static StaffUserDetails principal(StaffRole role) {
    return new StaffUserDetails(stored(role == StaffRole.ADMIN ? 1L : 2L, role.name().toLowerCase() + "@t.local", role));
  }

  private static AppUser stored(Long id, String email, StaffRole role) {
    AppUser u = new AppUser();
    u.setId(id);
    u.setEmail(email);
    u.setFullName(role.name());
    u.setRole(role);
    u.setPasswordHash("hash");
    u.setActive(true);
    return u;
  }
}
