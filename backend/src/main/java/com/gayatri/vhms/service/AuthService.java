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
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
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
  private final Map<String, long[]> loginFails = new ConcurrentHashMap<>();

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
    String email = req.email().trim().toLowerCase();
    if (loginBlocked(email)) {
      throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Too many sign-in attempts. Wait 15 minutes.");
    }
    AppUser existing = users.findByEmailIgnoreCase(email).orElse(null);
    if (existing != null && existing.isRemoved()) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "This account has been removed");
    }
    try {
      var auth = authManager.authenticate(new UsernamePasswordAuthenticationToken(email, req.password()));
      StaffUserDetails principal = (StaffUserDetails) auth.getPrincipal();
      if (!principal.isEnabled()) {
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Account is inactive or removed");
      }
      loginFails.remove(email);
      audit.record(principal, "auth.login", "app_users", email);
      String token = jwtService.generateToken(principal);
      return new LoginResponse(token, "Bearer", jwtProperties.getExpirationMs(), toUser(principal.getUser()));
    } catch (ResponseStatusException ex) {
      throw ex;
    } catch (AuthenticationException ex) {
      noteLoginFailure(email);
      audit.record(null, "auth.login_failed", "app_users", email);
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Email or password is wrong");
    }
  }

  private boolean loginBlocked(String email) {
    long[] row = loginFails.get(email);
    if (row == null) return false;
    long now = Instant.now().getEpochSecond();
    if (now - row[1] > 900) {
      loginFails.remove(email);
      return false;
    }
    return row[0] >= 8;
  }

  private void noteLoginFailure(String email) {
    long now = Instant.now().getEpochSecond();
    loginFails.compute(email, (key, row) -> {
      if (row == null || now - row[1] > 900) return new long[] {1, now};
      row[0] += 1;
      return row;
    });
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
    PasswordPolicy.requireStrong(req.password());
    user.setPasswordHash(encoder.encode(req.password()));
    user.setActive(true);
    user.setRemovedAt(null);
    UserResponse out = toUser(users.save(user));
    audit.record(principal, "user.create", "app_users", out.email() + " role=" + newRole.name());
    return out;
  }

  @Transactional
  public UserResponse updateUser(Long id, UpdateUserRequest req, StaffUserDetails principal) {
    AppUser user = users.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    if (user.isRemoved()) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Account is already removed");
    }

    assertCanManageAccount(principal, user);

    boolean mutating =
        (req.fullName() != null && !req.fullName().isBlank())
            || (req.role() != null && !req.role().isBlank())
            || req.active() != null
            || req.phone() != null
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
    if (req.phone() != null) {
      String phone = req.phone().isBlank() ? null : PasswordPolicy.normalizePhone(req.phone());
      if (phone == null && !req.phone().isBlank()) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter a 10-digit mobile number");
      }
      if (phone != null) {
        users.findActiveByPhone(phone)
            .filter(other -> !other.getId().equals(user.getId()))
            .ifPresent(other -> {
              throw new ResponseStatusException(HttpStatus.CONFLICT, "This mobile number is already registered");
            });
      }
      user.setPhone(phone);
    }
    if (req.newPassword() != null && !req.newPassword().isBlank()) {
      PasswordPolicy.requireStrong(req.newPassword());
      user.setPasswordHash(encoder.encode(req.newPassword()));
      user.setTokenVersion(user.getTokenVersion() + 1);
    }
    UserResponse out = toUser(users.save(user));
    audit.record(principal, "user.update", "app_users", "id=" + id + " email=" + out.email());
    return out;
  }

  /**
   * Soft-remove: sets removed_at, deactivates, keeps the row for booking/payment/audit FKs.
   * Owner may remove Managers and Staff; Manager may remove Front Desk Staff only.
   */
  @Transactional
  public UserResponse removeUser(Long id, StaffUserDetails principal) {
    AppUser user = users.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    if (user.isRemoved()) {
      return toUser(user);
    }
    assertCanRemoveAccount(principal, user);
    if (user.getRole() == StaffRole.ADMIN) {
      protectLastOwner(user);
    }
    if (principal.getUser().getId().equals(user.getId())) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You cannot remove your own account");
    }
    user.setActive(false);
    user.setRemovedAt(Instant.now());
    UserResponse out = toUser(users.save(user));
    audit.record(principal, "user.remove", "app_users", out.email() + " role=" + out.role().name());
    return out;
  }

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

  /** Owner: Managers + Staff roles. Manager: Front Desk only. Staff: never. */
  void assertCanRemoveAccount(StaffUserDetails principal, AppUser target) {
    assertCanManageAccount(principal, target);
    StaffRole actor = principal.getRole();
    if (actor == StaffRole.MANAGER && target.getRole() != StaffRole.FRONTDESK) {
      throw new ResponseStatusException(
          HttpStatus.FORBIDDEN,
          "Manager may only remove Staff (Front Desk) accounts"
      );
    }
  }

  private void protectLastOwner(AppUser target) {
    long activeOwners = users.countByRoleAndActiveTrueAndRemovedAtIsNull(StaffRole.ADMIN);
    if (target.isActive() && !target.isRemoved() && activeOwners <= 1) {
      throw new ResponseStatusException(
          HttpStatus.CONFLICT, "Cannot deactivate or remove the last active Owner account"
      );
    }
  }

  /** Normal list excludes removed accounts and legacy inactive demo emails. */
  public List<UserResponse> listUsers(boolean archived, StaffUserDetails principal) {
    if (archived) {
      if (principal == null || principal.getRole() != StaffRole.ADMIN) {
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the Owner can view archived accounts");
      }
      return users.findArchivedAccounts().stream().map(this::toUser).toList();
    }
    return users.findByRemovedAtIsNullOrderByFullNameAsc().stream()
        .filter(u -> !isLegacyHiddenDemo(u))
        .map(this::toUser)
        .toList();
  }

  /** Inactive @gayatrifunctionhall.com demos stay hidden from the normal list until soft-removed by migration. */
  static boolean isLegacyHiddenDemo(AppUser u) {
    if (u.isRemoved()) return true;
    if (u.isActive()) return false;
    String email = u.getEmail() == null ? "" : u.getEmail().toLowerCase(Locale.ROOT);
    return email.endsWith("@gayatrifunctionhall.com");
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
        u.isActive(),
        u.isRemoved(),
        u.getRemovedAt(),
        u.getPhone()
    );
  }

  private static String label(StaffRole role) {
    return switch (role) {
      case ADMIN -> "Owner";
      case MANAGER -> "Manager";
      case FRONTDESK -> "Staff / Front Desk";
      case HOUSEKEEPING -> "Housekeeping";
      case ACCOUNTS -> "Accounts";
    };
  }
}
