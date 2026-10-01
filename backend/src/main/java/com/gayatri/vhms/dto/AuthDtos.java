package com.gayatri.vhms.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.gayatri.vhms.domain.StaffRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
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
      Set<String> permissions,
      boolean active,
      boolean removed,
      java.time.Instant removedAt,
      String phone
  ) {}

  public record RoleInfo(String role, String label, Set<String> permissions) {}

  public record CreateUserRequest(
      @NotBlank @Email String email,
      @NotBlank String password,
      @NotBlank String fullName,
      @NotBlank String role
  ) {}

  public record UpdateUserRequest(
      String fullName,
      String role,
      Boolean active,
      String newPassword,
      String phone
  ) {}

  public record RolePermissionsUpdateRequest(
      @NotBlank String role,
      @NotNull Map<String, Boolean> permissions
  ) {}

  public record ManagerRefundLimitRequest(@NotNull BigDecimal amount) {}

  public record BookingPoliciesRequest(@NotBlank String policiesJson) {}

  public record AppSettingsResponse(Map<String, String> settings) {}

  public record RoleMatrixResponse(Map<String, Map<String, Boolean>> roles, List<String> catalog) {}

  public record AuditEntryResponse(
      Long id, Long userId, String action, String entity, String detail, java.time.Instant createdAt,
      String ipAddress
  ) {}

  public record OtpRequest(@NotBlank String phone) {}

  @JsonInclude(JsonInclude.Include.NON_NULL)
  public record OtpResponse(String message, int expiresInSeconds, String otp) {}

  public record VerifyOtpRequest(@NotBlank String phone, @NotBlank String otp) {}

  public record VerifyOtpResponse(String resetToken, String message) {}

  public record ResetPasswordRequest(@NotBlank String resetToken, @NotBlank String password) {}

  public record MessageResponse(String message) {}

  public record ApiError(String error, List<String> details) {}
}
