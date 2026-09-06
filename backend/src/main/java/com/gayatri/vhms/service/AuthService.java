package com.gayatri.vhms.service;

import com.gayatri.vhms.config.JwtProperties;
import com.gayatri.vhms.domain.StaffRole;
import com.gayatri.vhms.dto.AuthDtos.CreateUserRequest;
import com.gayatri.vhms.dto.AuthDtos.LoginRequest;
import com.gayatri.vhms.dto.AuthDtos.LoginResponse;
import com.gayatri.vhms.dto.AuthDtos.RoleInfo;
import com.gayatri.vhms.dto.AuthDtos.UserResponse;
import com.gayatri.vhms.entity.AppUser;
import com.gayatri.vhms.repository.AppUserRepository;
import com.gayatri.vhms.security.JwtService;
import com.gayatri.vhms.security.StaffUserDetails;
import java.util.Arrays;
import java.util.List;
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

  public AuthService(
      AuthenticationManager authManager,
      JwtService jwtService,
      JwtProperties jwtProperties,
      AppUserRepository users,
      PasswordEncoder encoder
  ) {
    this.authManager = authManager;
    this.jwtService = jwtService;
    this.jwtProperties = jwtProperties;
    this.users = users;
    this.encoder = encoder;
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
        .map(r -> new RoleInfo(r.name(), label(r), r.getPermissions()))
        .toList();
  }

  @Transactional
  public UserResponse createUser(CreateUserRequest req) {
    if (users.existsByEmailIgnoreCase(req.email())) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already registered");
    }
    AppUser user = new AppUser();
    user.setEmail(req.email().trim().toLowerCase());
    user.setFullName(req.fullName().trim());
    user.setRole(StaffRole.from(req.role()));
    user.setPasswordHash(encoder.encode(req.password()));
    user.setActive(true);
    return toUser(users.save(user));
  }

  public List<UserResponse> listUsers() {
    return users.findAll().stream().map(this::toUser).toList();
  }

  private UserResponse toUser(AppUser u) {
    return new UserResponse(
        u.getId(),
        u.getEmail(),
        u.getFullName(),
        u.getRole(),
        label(u.getRole()),
        u.getRole().getPermissions()
    );
  }

  private static String label(StaffRole role) {
    return switch (role) {
      case ADMIN -> "Administrator";
      case MANAGER -> "Property manager";
      case FRONTDESK -> "Front desk";
      case HOUSEKEEPING -> "Housekeeping";
      case ACCOUNTS -> "Accounts";
    };
  }
}
