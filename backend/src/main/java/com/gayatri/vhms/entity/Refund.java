package com.gayatri.vhms.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "refunds")
public class Refund {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "booking_id", nullable = false)
  private Long bookingId;

  @Column(name = "payment_id")
  private Long paymentId;

  @Column(nullable = false)
  private BigDecimal amount = BigDecimal.ZERO;

  /** Pending | Approved | Paid | Rejected. */
  @Column(nullable = false, length = 40)
  private String status = "Pending";

  @Column(columnDefinition = "TEXT")
  private String reason;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "requested_by")
  private AppUser requestedBy;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "approved_by")
  private AppUser approvedBy;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  @PrePersist
  void onCreate() {
    Instant now = Instant.now();
    createdAt = now;
    updatedAt = now;
  }

  @PreUpdate
  void onUpdate() {
    updatedAt = Instant.now();
  }

  public Long getId() { return id; }
  public Long getBookingId() { return bookingId; }
  public void setBookingId(Long bookingId) { this.bookingId = bookingId; }
  public Long getPaymentId() { return paymentId; }
  public void setPaymentId(Long paymentId) { this.paymentId = paymentId; }
  public BigDecimal getAmount() { return amount; }
  public void setAmount(BigDecimal amount) { this.amount = amount; }
  public String getStatus() { return status; }
  public void setStatus(String status) { this.status = status; }
  public String getReason() { return reason; }
  public void setReason(String reason) { this.reason = reason; }
  public AppUser getRequestedBy() { return requestedBy; }
  public void setRequestedBy(AppUser requestedBy) { this.requestedBy = requestedBy; }
  public AppUser getApprovedBy() { return approvedBy; }
  public void setApprovedBy(AppUser approvedBy) { this.approvedBy = approvedBy; }
  public Instant getCreatedAt() { return createdAt; }
  public Instant getUpdatedAt() { return updatedAt; }
}
