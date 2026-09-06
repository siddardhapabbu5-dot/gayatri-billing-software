package com.gayatri.vhms.dto;

import com.gayatri.vhms.domain.StaffRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import java.util.List;
import java.util.Set;

public final class AuthDtos {
  private AuthDtos() {}

  public record LoginRequest(
      @NotBlank @Email String email,
      @NotBlank String password
  ) {}

  public record LoginResponse(
      String token,
      String tokenType,
      long expiresInMs,
      UserResponse user
  ) {}

  public record UserResponse(
      Long id,
      String email,
      String fullName,
      StaffRole role,
      String roleLabel,
      Set<String> permissions
  ) {}

  public record RoleInfo(String role, String label, Set<String> permissions) {}

  public record CreateUserRequest(
      @NotBlank @Email String email,
      @NotBlank String password,
      @NotBlank String fullName,
      @NotBlank String role
  ) {}

  public record MessageResponse(String message) {}

  public record ApiError(String error, List<String> details) {}
}
