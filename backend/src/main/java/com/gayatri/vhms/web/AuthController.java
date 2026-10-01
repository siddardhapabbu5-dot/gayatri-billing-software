package com.gayatri.vhms.web;

import com.gayatri.vhms.dto.AuthDtos.LoginRequest;
import com.gayatri.vhms.dto.AuthDtos.LoginResponse;
import com.gayatri.vhms.dto.AuthDtos.MessageResponse;
import com.gayatri.vhms.dto.AuthDtos.OtpRequest;
import com.gayatri.vhms.dto.AuthDtos.OtpResponse;
import com.gayatri.vhms.dto.AuthDtos.ResetPasswordRequest;
import com.gayatri.vhms.dto.AuthDtos.RoleInfo;
import com.gayatri.vhms.dto.AuthDtos.UserResponse;
import com.gayatri.vhms.dto.AuthDtos.VerifyOtpRequest;
import com.gayatri.vhms.dto.AuthDtos.VerifyOtpResponse;
import com.gayatri.vhms.security.StaffUserDetails;
import com.gayatri.vhms.service.AuthService;
import com.gayatri.vhms.service.PasswordResetService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
  private final AuthService auth;
  private final PasswordResetService passwordReset;

  public AuthController(AuthService auth, PasswordResetService passwordReset) {
    this.auth = auth;
    this.passwordReset = passwordReset;
  }

  @PostMapping("/login")
  public LoginResponse login(@Valid @RequestBody LoginRequest req) {
    return auth.login(req);
  }

  @PostMapping("/forgot/otp")
  public OtpResponse forgotOtp(@Valid @RequestBody OtpRequest req) {
    return passwordReset.requestOtp(req.phone());
  }

  @PostMapping("/forgot/verify")
  public VerifyOtpResponse forgotVerify(@Valid @RequestBody VerifyOtpRequest req) {
    return passwordReset.verify(req.phone(), req.otp());
  }

  @PostMapping("/forgot/reset")
  public MessageResponse forgotReset(@Valid @RequestBody ResetPasswordRequest req, HttpServletRequest http) {
    return new MessageResponse(passwordReset.complete(req.resetToken(), req.password(), ClientIp.of(http)));
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
class HealthController {
  private final JdbcTemplate jdbc;

  HealthController(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @GetMapping("/api/health")
  public Map<String, String> health() {
    boolean database = readable("select 1");
    boolean authentication = readable("select count(*) from app_users");
    boolean sync = readable("select count(*) from hall_reservations")
        && readable("select count(*) from payments")
        && readable("select count(*) from expenses");
    Map<String, String> body = new LinkedHashMap<>();
    body.put("server", "online");
    body.put("database", database ? "connected" : "unavailable");
    body.put("authentication", authentication ? "working" : "unavailable");
    body.put("sync", sync ? "working" : "unavailable");
    body.put("timestamp", ZonedDateTime.now(ZoneId.of("Asia/Kolkata")).format(DateTimeFormatter.ISO_OFFSET_DATE_TIME));
    body.put("status", database ? "UP" : "DEGRADED");
    body.put("service", "gayatri-vhms-backend");
    return body;
  }

  private boolean readable(String sql) {
    try {
      jdbc.queryForObject(sql, Integer.class);
      return true;
    } catch (RuntimeException ex) {
      return false;
    }
  }
}
