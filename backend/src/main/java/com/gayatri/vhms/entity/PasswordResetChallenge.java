package com.gayatri.vhms.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "password_reset_challenges")
public class PasswordResetChallenge {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "user_id", nullable = false)
  private Long userId;

  @Column(name = "otp_hash", nullable = false, length = 128)
  private String otpHash;

  @Column(name = "expires_at", nullable = false)
  private Instant expiresAt;

  @Column(nullable = false)
  private int attempts;

  @Column(nullable = false)
  private boolean verified;

  @Column(name = "reset_hash", length = 128)
  private String resetHash;

  @Column(name = "reset_expires_at")
  private Instant resetExpiresAt;

  @Column(nullable = false)
  private boolean consumed;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  @PrePersist
  void onCreate() {
    if (createdAt == null) {
      createdAt = Instant.now();
    }
  }

  public Long getId() { return id; }
  public void setId(Long id) { this.id = id; }
  public Long getUserId() { return userId; }
  public void setUserId(Long userId) { this.userId = userId; }
  public String getOtpHash() { return otpHash; }
  public void setOtpHash(String otpHash) { this.otpHash = otpHash; }
  public Instant getExpiresAt() { return expiresAt; }
  public void setExpiresAt(Instant expiresAt) { this.expiresAt = expiresAt; }
  public int getAttempts() { return attempts; }
  public void setAttempts(int attempts) { this.attempts = attempts; }
  public boolean isVerified() { return verified; }
  public void setVerified(boolean verified) { this.verified = verified; }
  public String getResetHash() { return resetHash; }
  public void setResetHash(String resetHash) { this.resetHash = resetHash; }
  public Instant getResetExpiresAt() { return resetExpiresAt; }
  public void setResetExpiresAt(Instant resetExpiresAt) { this.resetExpiresAt = resetExpiresAt; }
  public boolean isConsumed() { return consumed; }
  public void setConsumed(boolean consumed) { this.consumed = consumed; }
  public Instant getCreatedAt() { return createdAt; }
}
