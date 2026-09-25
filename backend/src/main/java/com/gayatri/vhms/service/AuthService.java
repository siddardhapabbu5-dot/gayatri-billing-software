package com.gayatri.vhms.service;

import com.gayatri.vhms.config.JwtProperties;
import com.gayatri.vhms.domain.StaffRole;
import com.gayatri.vhms.dto.AuthDtos.CreateUserRequest;
import com.gayatri.vhms.dto.AuthDtos.LoginRequest;
import com.gayatri.vhms.dto.AuthDtos.LoginResponse;
import com.gayatri.vhms.dto.AuthDtos.RoleInfo;
import com.gayatri.vhms.dto.AuthDtos.UpdateUserRequest;
import com.gayatri.vhms.dto.AuthDtos.UserResponse;
import com.gayatri.vhms.entity.AppUser;
import com.gayatri.vhms.repository.AppUserRepository;
import com.gayatri.vhms.security.JwtService;
import com.gayatri.vhms.security.StaffUserDetails;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuthService {
  private final AuthenticationManager authManager;
  private final JwtService jwtService;
  private final JwtProperties jwtProperties;
  private final AppUserRepository users;
  private final PasswordEncoder encoder;
  private final PermissionService permissions;
  private final AuditService audit;

  public AuthService(
      AuthenticationManager authManager,
      JwtService jwtService,
      JwtProperties jwtProperties,
      AppUserRepository users,
      PasswordEncoder encoder,
      PermissionService permissions,
      AuditService audit
  ) {
    this.authManager = authManager;
    this.jwtService = jwtService;
    this.jwtProperties = jwtProperties;
    this.users = users;
    this.encoder = encoder;
    this.permissions = permissions;
    this.audit = audit;
  }

  public LoginResponse login(LoginRequest req) {
    var auth = authManager.authenticate(
        new UsernamePasswordAuthenticationToken(req.email().trim().toLowerCase(), req.password())
    );
    StaffUserDetails principal = (StaffUserDetails) auth.getPrincipal();
    String token = jwtService.generateToken(principal);
    return new LoginResponse(token, "Bearer", jwtProperties.getExpirationMs(), toUser(principal.getUser()));
  }

  public UserResponse me(StaffUserDetails principal) {
    return toUser(principal.getUser());
  }

  public List<RoleInfo> roles() {
    return Arrays.stream(StaffRole.values())
        .map(r -> new RoleInfo(r.name(), label(r), permissions.effectivePermissions(r)))
        .toList();
  }

  @Transactional
  public UserResponse createUser(CreateUserRequest req, StaffUserDetails principal) {
    StaffRole newRole = StaffRole.from(req.role());
    assertCanCreate(principal, newRole);
    if (users.existsByEmailIgnoreCase(req.email())) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already registered");
    }
    AppUser user = new AppUser();
    user.setEmail(req.email().trim().toLowerCase());
    user.setFullName(req.fullName().trim());
    user.setRole(newRole);
    user.setPasswordHash(encoder.encode(req.password()));
    user.setActive(true);
    UserResponse out = toUser(users.save(user));
    audit.record(principal, "user.create", "app_users", out.email() + " role=" + newRole.name());
    return out;
  }

  @Transactional
  public UserResponse updateUser(Long id, UpdateUserRequest req, StaffUserDetails principal) {
    AppUser user = users.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

    // Hard hierarchy: Manager may only touch Front Desk; only Owner may touch Owner/Manager.
    assertCanManageAccount(principal, user);

    boolean mutating =
        (req.fullName() != null && !req.fullName().isBlank())
            || (req.role() != null && !req.role().isBlank())
            || req.active() != null
            || (req.newPassword() != null && !req.newPassword().isBlank());
    if (!mutating) {
      return toUser(user);
    }

    if (req.fullName() != null && !req.fullName().isBlank()) {
      user.setFullName(req.fullName().trim());
    }
    if (req.role() != null && !req.role().isBlank()) {
      StaffRole next = StaffRole.from(req.role());
      assertCanCreate(principal, next);
      if (user.getRole() == StaffRole.ADMIN && next != StaffRole.ADMIN) {
        protectLastOwner(user);
      }
      user.setRole(next);
    }
    if (req.active() != null) {
      if (!req.active() && user.getRole() == StaffRole.ADMIN) {
        protectLastOwner(user);
      }
      user.setActive(req.active());
    }
    if (req.newPassword() != null && !req.newPassword().isBlank()) {
      if (req.newPassword().length() < 8) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password must be at least 8 characters");
      }
      user.setPasswordHash(encoder.encode(req.newPassword()));
    }
    UserResponse out = toUser(users.save(user));
    audit.record(principal, "user.update", "app_users", "id=" + id + " email=" + out.email());
    return out;
  }

  /**
   * System rules (not permission-toggleable):
   * Owner may create any role; Manager may create Front Desk only; everyone else is denied.
   */
  void assertCanCreate(StaffUserDetails principal, StaffRole newRole) {
    if (principal == null) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Authentication required");
    }
    StaffRole actor = principal.getRole();
    if (actor == StaffRole.ADMIN) {
      return;
    }
    if (actor == StaffRole.MANAGER) {
      if (newRole != StaffRole.FRONTDESK) {
        throw new ResponseStatusException(
            HttpStatus.FORBIDDEN,
            "Manager may only create Staff (Front Desk) accounts"
        );
      }
      return;
    }
    throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only Owner or Manager can create accounts");
  }

  /**
   * System rules: only Owner may create/edit/deactivate/reset/change-role of Owner or Manager.
   * Manager may manage Front Desk accounts only.
   */
  void assertCanManageAccount(StaffUserDetails principal, AppUser target) {
    if (principal == null || target == null) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Authentication required");
    }
    StaffRole actor = principal.getRole();
    StaffRole targetRole = target.getRole();
    if (actor == StaffRole.ADMIN) {
      return;
    }
    if (actor == StaffRole.MANAGER) {
      if (targetRole == StaffRole.ADMIN || targetRole == StaffRole.MANAGER) {
        throw new ResponseStatusException(
            HttpStatus.FORBIDDEN,
            "Only the Owner can manage Owner or Manager accounts"
        );
      }
      if (targetRole != StaffRole.FRONTDESK) {
        throw new ResponseStatusException(
            HttpStatus.FORBIDDEN,
            "Manager may only manage Staff (Front Desk) accounts"
        );
      }
      return;
    }
    throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Missing permission to manage users");
  }

  private void protectLastOwner(AppUser target) {
    long activeOwners = users.countByRoleAndActiveTrue(StaffRole.ADMIN);
    if (target.isActive() && activeOwners <= 1) {
      throw new ResponseStatusException(
          HttpStatus.CONFLICT, "Cannot deactivate or demote the last active Owner account"
      );
    }
  }

  public List<UserResponse> listUsers() {
    return users.findAll().stream().map(this::toUser).toList();
  }

  private UserResponse toUser(AppUser u) {
    Set<String> perms = permissions.effectivePermissions(u.getRole());
    return new UserResponse(
        u.getId(),
        u.getEmail(),
        u.getFullName(),
        u.getRole(),
        label(u.getRole()),
        perms,
        u.isActive()
    );
  }

  private static String label(StaffRole role) {
    return switch (role) {
      case ADMIN -> "Owner administrator";
      case MANAGER -> "Property manager";
      case FRONTDESK -> "Staff";
      case HOUSEKEEPING -> "Housekeeping";
      case ACCOUNTS -> "Accounts";
    };
  }
}
