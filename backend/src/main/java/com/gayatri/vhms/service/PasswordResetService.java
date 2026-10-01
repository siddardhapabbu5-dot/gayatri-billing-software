package com.gayatri.vhms.service;

import com.gayatri.vhms.config.JwtProperties;
import com.gayatri.vhms.domain.StaffRole;
import com.gayatri.vhms.dto.AuthDtos.OtpResponse;
import com.gayatri.vhms.dto.AuthDtos.VerifyOtpResponse;
import com.gayatri.vhms.entity.AppUser;
import com.gayatri.vhms.entity.PasswordResetChallenge;
import com.gayatri.vhms.repository.AppUserRepository;
import com.gayatri.vhms.repository.PasswordResetRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.HexFormat;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class PasswordResetService {
  static final Duration OTP_TTL = Duration.ofMinutes(5);
  static final int MAX_ATTEMPTS = 3;

  private final AppUserRepository users;
  private final PasswordResetRepository challenges;
  private final PasswordEncoder encoder;
  private final AuditService audit;
  private final OtpSender otpSender;
  private final Clock clock;
  private final String pepper;
  private final SecureRandom random = new SecureRandom();

  @Autowired
  public PasswordResetService(
      AppUserRepository users,
      PasswordResetRepository challenges,
      PasswordEncoder encoder,
      AuditService audit,
      OtpSender otpSender,
      JwtProperties jwtProperties
  ) {
    this(users, challenges, encoder, audit, otpSender, Clock.systemUTC(), jwtProperties.getSecret());
  }

  PasswordResetService(
      AppUserRepository users,
      PasswordResetRepository challenges,
      PasswordEncoder encoder,
      AuditService audit,
      OtpSender otpSender,
      Clock clock,
      String pepper
  ) {
    this.users = users;
    this.challenges = challenges;
    this.encoder = encoder;
    this.audit = audit;
    this.otpSender = otpSender;
    this.clock = clock;
    this.pepper = pepper == null ? "" : pepper;
  }

  @Transactional
  public OtpResponse requestOtp(String rawPhone) {
    String phone = requirePhone(rawPhone);
    AppUser user = users.findActiveByPhone(phone)
        .orElseThrow(() -> new ResponseStatusException(
            HttpStatus.NOT_FOUND, "This mobile number is not registered"));
    for (PasswordResetChallenge open : challenges.findByUserIdAndConsumedFalse(user.getId())) {
      open.setConsumed(true);
    }
    String otp = String.format("%06d", random.nextInt(1_000_000));
    PasswordResetChallenge row = new PasswordResetChallenge();
    row.setUserId(user.getId());
    row.setOtpHash(hash(otp));
    row.setExpiresAt(clock.instant().plus(OTP_TTL));
    row.setAttempts(0);
    row.setVerified(false);
    row.setConsumed(false);
    challenges.save(row);
    boolean sent = otpSender.deliver(phone, otp);
    String ending = phone.substring(6);
    String message = sent
        ? "OTP sent to the mobile number ending " + ending + ". It is valid for 5 minutes."
        : "Your OTP is ready. It is valid for 5 minutes.";
    return new OtpResponse(message, (int) OTP_TTL.toSeconds(), sent ? null : otp);
  }

  @Transactional
  public VerifyOtpResponse verify(String rawPhone, String otp) {
    String phone = requirePhone(rawPhone);
    AppUser user = users.findActiveByPhone(phone)
        .orElseThrow(() -> new ResponseStatusException(
            HttpStatus.NOT_FOUND, "This mobile number is not registered"));
    PasswordResetChallenge row = openChallenge(user.getId());
    Instant now = clock.instant();
    if (row.getExpiresAt().isBefore(now)) {
      row.setConsumed(true);
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "This OTP has expired. Request a new one.");
    }
    if (row.getAttempts() >= MAX_ATTEMPTS) {
      row.setConsumed(true);
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Too many attempts. Request a new OTP.");
    }
    if (otp == null || !constantEquals(row.getOtpHash(), hash(otp.trim()))) {
      row.setAttempts(row.getAttempts() + 1);
      if (row.getAttempts() >= MAX_ATTEMPTS) {
        row.setConsumed(true);
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Too many attempts. Request a new OTP.");
      }
      int left = MAX_ATTEMPTS - row.getAttempts();
      String tries = left == 1 ? "1 attempt left" : left + " attempts left";
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "OTP is wrong. " + tries + ".");
    }
    byte[] tokenBytes = new byte[32];
    random.nextBytes(tokenBytes);
    String token = HexFormat.of().formatHex(tokenBytes);
    row.setVerified(true);
    row.setResetHash(hash(token));
    row.setResetExpiresAt(now.plus(OTP_TTL));
    return new VerifyOtpResponse(token, "OTP verified. Set a new password.");
  }

  @Transactional
  public String complete(String resetToken, String password, String ipAddress) {
    if (resetToken == null || resetToken.isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Verify the OTP before setting a password.");
    }
    PasswordPolicy.requireStrong(password);
    PasswordResetChallenge row = challenges.findByResetHashAndConsumedFalse(hash(resetToken.trim()))
        .orElseThrow(() -> new ResponseStatusException(
            HttpStatus.BAD_REQUEST, "This reset has expired. Start again."));
    if (!row.isVerified() || row.getResetExpiresAt() == null || row.getResetExpiresAt().isBefore(clock.instant())) {
      row.setConsumed(true);
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "This reset has expired. Start again.");
    }
    AppUser user = users.findById(row.getUserId())
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Account not found"));
    if (!user.isActive() || user.isRemoved()) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "This account cannot sign in");
    }
    user.setPasswordHash(encoder.encode(password));
    user.setTokenVersion(user.getTokenVersion() + 1);
    users.save(user);
    row.setConsumed(true);
    audit.record(
        user.getId(),
        "Password Reset",
        "app_users",
        "User: " + user.getFullName() + " (" + roleLabel(user.getRole()) + ")",
        ipAddress == null || ipAddress.isBlank() ? "unknown" : ipAddress
    );
    return "Password updated. Sign in with your new password.";
  }

  private PasswordResetChallenge openChallenge(Long userId) {
    return challenges.findByUserIdAndConsumedFalse(userId).stream()
        .max(Comparator.comparing(PasswordResetChallenge::getId, Comparator.nullsFirst(Long::compareTo)))
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request an OTP first."));
  }

  private static String requirePhone(String raw) {
    String phone = PasswordPolicy.normalizePhone(raw);
    if (phone == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter a 10-digit mobile number");
    }
    return phone;
  }

  private String hash(String value) {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      digest.update(pepper.getBytes(StandardCharsets.UTF_8));
      digest.update((byte) ':');
      return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
    } catch (NoSuchAlgorithmException ex) {
      throw new IllegalStateException(ex);
    }
  }

  private static boolean constantEquals(String left, String right) {
    return MessageDigest.isEqual(left.getBytes(StandardCharsets.UTF_8), right.getBytes(StandardCharsets.UTF_8));
  }

  private static String roleLabel(StaffRole role) {
    return switch (role) {
      case ADMIN -> "Owner";
      case MANAGER -> "Manager";
      case FRONTDESK -> "Staff / Front Desk";
      case HOUSEKEEPING -> "Housekeeping";
      case ACCOUNTS -> "Accounts";
    };
  }
}
