package com.gayatri.vhms.web;

import com.gayatri.vhms.dto.AuthDtos.CreateUserRequest;
import com.gayatri.vhms.dto.AuthDtos.LoginRequest;
import com.gayatri.vhms.dto.AuthDtos.LoginResponse;
import com.gayatri.vhms.dto.AuthDtos.RoleInfo;
import com.gayatri.vhms.dto.AuthDtos.UserResponse;
import com.gayatri.vhms.security.StaffUserDetails;
import com.gayatri.vhms.service.AuthService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
  private final AuthService auth;

  public AuthController(AuthService auth) {
    this.auth = auth;
  }

  @PostMapping("/login")
  public LoginResponse login(@Valid @RequestBody LoginRequest req) {
    return auth.login(req);
  }

  @GetMapping("/me")
  public UserResponse me(@AuthenticationPrincipal StaffUserDetails principal) {
    return auth.me(principal);
  }

  @GetMapping("/roles")
  public List<RoleInfo> roles() {
    return auth.roles();
  }
}

@RestController
@RequestMapping("/api/admin/users")
@PreAuthorize("hasRole('ADMIN')")
class AdminUserController {
  private final AuthService auth;

  AdminUserController(AuthService auth) {
    this.auth = auth;
  }

  @GetMapping
  public List<UserResponse> list() {
    return auth.listUsers();
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public UserResponse create(@Valid @RequestBody CreateUserRequest req) {
    return auth.createUser(req);
  }
}

@RestController
class HealthController {
  @GetMapping("/api/health")
  public Map<String, String> health() {
    return Map.of("status", "UP", "service", "gayatri-vhms-backend");
  }
}
