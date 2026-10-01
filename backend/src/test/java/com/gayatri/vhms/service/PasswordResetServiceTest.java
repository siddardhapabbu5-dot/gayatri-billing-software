package com.gayatri.vhms.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.gayatri.vhms.domain.StaffRole;
import com.gayatri.vhms.dto.AuthDtos.OtpResponse;
import com.gayatri.vhms.entity.AppUser;
import com.gayatri.vhms.entity.PasswordResetChallenge;
import com.gayatri.vhms.repository.AppUserRepository;
import com.gayatri.vhms.repository.PasswordResetRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

class PasswordResetServiceTest {
  private final List<PasswordResetChallenge> rows = new ArrayList<>();
  private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
  private final AtomicReference<Object[]> auditRow = new AtomicReference<>();
  private final MutableClock clock = new MutableClock(Instant.parse("2026-09-30T10:00:00Z"));
  private AppUser owner;
  private PasswordResetService service;
  private boolean deliverSms;

  @BeforeEach
  void setUp() {
    rows.clear();
    deliverSms = false;
    owner = new AppUser();
    owner.setId(7L);
    owner.setEmail("owner@gayatri.local");
    owner.setFullName("Gayatri");
    owner.setRole(StaffRole.ADMIN);
    owner.setActive(true);
    owner.setPhone("9849600111");
    owner.setPasswordHash("old-hash");

    AppUserRepository users = mock(AppUserRepository.class);
    when(users.findActiveByPhone("9849600111")).thenReturn(Optional.of(owner));
    when(users.findActiveByPhone("9000000000")).thenReturn(Optional.empty());
    when(users.findById(7L)).thenReturn(Optional.of(owner));
    when(users.save(any(AppUser.class))).thenAnswer(inv -> inv.getArgument(0));

    PasswordResetRepository challenges = mock(PasswordResetRepository.class);
    when(challenges.findByUserIdAndConsumedFalse(7L)).thenAnswer(inv ->
        rows.stream().filter(row -> row.getUserId().equals(7L) && !row.isConsumed()).toList());
    when(challenges.findByResetHashAndConsumedFalse(anyString())).thenAnswer(inv ->
        rows.stream()
            .filter(row -> !row.isConsumed() && inv.getArgument(0).equals(row.getResetHash()))
            .findFirst());
    when(challenges.save(any(PasswordResetChallenge.class))).thenAnswer(inv -> {
      PasswordResetChallenge row = inv.getArgument(0);
      if (row.getId() == null) {
        row.setId((long) rows.size() + 1);
        rows.add(row);
      }
      return row;
    });

    AuditService audit = mock(AuditService.class);
    doAnswer(inv -> {
      auditRow.set(inv.getArguments());
      return null;
    }).when(audit).record(anyLong(), anyString(), anyString(), anyString(), anyString());

    service = new PasswordResetService(
        users, challenges, encoder, audit, (phone, code) -> deliverSms, clock, "test-pepper");
  }

  @Test
  void unknownMobileIsRejected() {
    ResponseStatusException ex = org.junit.jupiter.api.Assertions.assertThrows(
        ResponseStatusException.class, () -> service.requestOtp("9000000000"));
    assertEquals("This mobile number is not registered", ex.getReason());
  }

  @Test
  void codeIsShownOnlyWhenSmsIsNotConfiguredAndIsNotStoredInClear() {
    OtpResponse shown = service.requestOtp("9849600111");
    assertEquals(300, shown.expiresInSeconds());
    assertTrue(shown.otp().matches("\\d{6}"));
    assertNotEquals(shown.otp(), rows.get(0).getOtpHash());

    rows.clear();
    deliverSms = true;
    OtpResponse sent = service.requestOtp("+91 98496 00111");
    assertNull(sent.otp());
    assertTrue(sent.message().contains("ending 0111"));
  }

  @Test
  void expiredCodeIsRejected() {
    service.requestOtp("9849600111");
    clock.now = clock.now.plusSeconds(6 * 60);
    ResponseStatusException ex = org.junit.jupiter.api.Assertions.assertThrows(
        ResponseStatusException.class, () -> service.verify("9849600111", rows.get(0).getOtpHash()));
    assertEquals("This OTP has expired. Request a new one.", ex.getReason());
  }

  @Test
  void thirdWrongAttemptLocksTheCode() {
    OtpResponse issued = service.requestOtp("9849600111");
    assertWrong("OTP is wrong. 2 attempts left.");
    assertWrong("OTP is wrong. 1 attempt left.");
    assertWrong("Too many attempts. Request a new OTP.");
    ResponseStatusException locked = org.junit.jupiter.api.Assertions.assertThrows(
        ResponseStatusException.class, () -> service.verify("9849600111", issued.otp()));
    assertEquals("Request an OTP first.", locked.getReason());
  }

  @Test
  void resetStoresAHashLogsOutOldTokensAndWritesTheAudit() {
    OtpResponse issued = service.requestOtp("9849600111");
    String wrong = "000000".equals(issued.otp()) ? "111111" : "000000";
    org.junit.jupiter.api.Assertions.assertThrows(
        ResponseStatusException.class, () -> service.verify("9849600111", wrong));
    var token = service.verify("9849600111", issued.otp());

    ResponseStatusException weak = org.junit.jupiter.api.Assertions.assertThrows(
        ResponseStatusException.class, () -> service.complete(token.resetToken(), "gayatri1", "203.0.113.8"));
    assertTrue(weak.getReason().contains("uppercase"));

    String message = service.complete(token.resetToken(), "Gayatri1!", "203.0.113.8");
    assertEquals("Password updated. Sign in with your new password.", message);
    assertTrue(encoder.matches("Gayatri1!", owner.getPasswordHash()));
    assertNotEquals("Gayatri1!", owner.getPasswordHash());
    assertEquals(1, owner.getTokenVersion());
    assertEquals(7L, auditRow.get()[0]);
    assertEquals("Password Reset", auditRow.get()[1]);
    assertEquals("User: Gayatri (Owner)", auditRow.get()[3]);
    assertEquals("203.0.113.8", auditRow.get()[4]);
    assertFalse(encoder.matches("old-hash", owner.getPasswordHash()));
  }

  private void assertWrong(String reason) {
    ResponseStatusException ex = org.junit.jupiter.api.Assertions.assertThrows(
        ResponseStatusException.class, () -> service.verify("9849600111", "000000"));
    assertEquals(reason, ex.getReason());
  }

  private static final class MutableClock extends Clock {
    private Instant now;

    private MutableClock(Instant now) {
      this.now = now;
    }

    @Override
    public ZoneOffset getZone() {
      return ZoneOffset.UTC;
    }

    @Override
    public Clock withZone(java.time.ZoneId zone) {
      return this;
    }

    @Override
    public Instant instant() {
      return now;
    }
  }
}
