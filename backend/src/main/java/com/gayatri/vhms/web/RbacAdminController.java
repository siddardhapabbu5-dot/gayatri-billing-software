package com.gayatri.vhms.web;

import com.gayatri.vhms.domain.PermissionKeys;
import com.gayatri.vhms.domain.StaffRole;
import com.gayatri.vhms.dto.AuthDtos.AppSettingsResponse;
import com.gayatri.vhms.dto.AuthDtos.AuditEntryResponse;
import com.gayatri.vhms.dto.AuthDtos.BookingPoliciesRequest;
import com.gayatri.vhms.dto.AuthDtos.CreateUserRequest;
import com.gayatri.vhms.dto.AuthDtos.ManagerRefundLimitRequest;
import com.gayatri.vhms.dto.AuthDtos.RoleMatrixResponse;
import com.gayatri.vhms.dto.AuthDtos.RolePermissionsUpdateRequest;
import com.gayatri.vhms.dto.AuthDtos.UpdateUserRequest;
import com.gayatri.vhms.dto.AuthDtos.UserResponse;
import com.gayatri.vhms.security.StaffUserDetails;
import com.gayatri.vhms.service.AuditService;
import com.gayatri.vhms.service.AuthService;
import com.gayatri.vhms.service.PermissionService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/users")
@PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
class AdminUserController {
  private final AuthService auth;

  AdminUserController(AuthService auth) {
    this.auth = auth;
  }

  @GetMapping
  public List<UserResponse> list(
      @RequestParam(defaultValue = "false") boolean archived,
      @AuthenticationPrincipal StaffUserDetails principal
  ) {
    return auth.listUsers(archived, principal);
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public UserResponse create(
      @Valid @RequestBody CreateUserRequest req,
      @AuthenticationPrincipal StaffUserDetails principal
  ) {
    return auth.createUser(req, principal);
  }

  @PutMapping("/{id}")
  public UserResponse update(
      @PathVariable Long id,
      @RequestBody UpdateUserRequest req,
      @AuthenticationPrincipal StaffUserDetails principal
  ) {
    return auth.updateUser(id, req, principal);
  }

  @PostMapping("/{id}/remove")
  public UserResponse remove(
      @PathVariable Long id,
      @AuthenticationPrincipal StaffUserDetails principal
  ) {
    return auth.removeUser(id, principal);
  }
}

@RestController
@RequestMapping("/api/admin/rbac")
public class RbacAdminController {
  private final PermissionService permissions;
  private final AuditService audit;

  public RbacAdminController(PermissionService permissions, AuditService audit) {
    this.permissions = permissions;
    this.audit = audit;
  }

  @GetMapping("/matrix")
  @PreAuthorize("hasAuthority('PERM_ALL') or hasAuthority('PERM_USERS_PERMISSIONS') or hasAuthority('PERM_USER_MANAGE')")
  public RoleMatrixResponse matrix() {
    return new RoleMatrixResponse(permissions.matrixForRoles(), PermissionKeys.EDITABLE);
  }

  @PutMapping("/roles")
  @PreAuthorize("hasAuthority('PERM_ALL') or hasAuthority('PERM_USERS_PERMISSIONS')")
  public RoleMatrixResponse updateRole(
      @Valid @RequestBody RolePermissionsUpdateRequest req,
      @AuthenticationPrincipal StaffUserDetails actor
  ) {
    permissions.replaceRolePermissions(StaffRole.from(req.role()), req.permissions(), actor);
    audit.record(actor, "role.permissions.update", "role_permissions", "role=" + req.role());
    return matrix();
  }

  @GetMapping("/settings")
  @PreAuthorize("hasAuthority('PERM_ALL') or hasAuthority('PERM_USERS_PERMISSIONS') or hasAuthority('PERM_USER_MANAGE') or hasAuthority('PERM_SETTINGS_PROPERTY')")
  public AppSettingsResponse settings() {
    return new AppSettingsResponse(permissions.publicSettings());
  }

  @PutMapping("/settings/manager-refund-limit")
  @PreAuthorize("hasAuthority('PERM_ALL') or hasAuthority('PERM_USERS_PERMISSIONS')")
  public AppSettingsResponse setManagerRefundLimit(
      @Valid @RequestBody ManagerRefundLimitRequest req,
      @AuthenticationPrincipal StaffUserDetails actor
  ) {
    permissions.setManagerRefundLimit(req.amount(), actor);
    audit.record(actor, "settings.manager_refund_limit", "app_settings", req.amount().toPlainString());
    return settings();
  }

  @PutMapping("/settings/booking-policies")
  @PreAuthorize("hasAuthority('PERM_ALL') or hasAuthority('PERM_PRICES_EDIT')")
  public AppSettingsResponse setBookingPolicies(
      @Valid @RequestBody BookingPoliciesRequest req,
      @AuthenticationPrincipal StaffUserDetails actor
  ) {
    permissions.setBookingPoliciesJson(req.policiesJson(), actor);
    audit.record(actor, "settings.booking_policies", "app_settings", "updated");
    return settings();
  }

  @GetMapping("/audit")
  @PreAuthorize("hasAuthority('PERM_ALL') or hasAuthority('PERM_USERS_PERMISSIONS') or hasAuthority('PERM_USER_MANAGE')")
  public List<AuditEntryResponse> auditLog() {
    return audit.recent().stream()
        .map(a -> new AuditEntryResponse(
            a.getId(), a.getUserId(), a.getAction(), a.getEntity(), a.getDetail(), a.getCreatedAt()))
        .toList();
  }
}
