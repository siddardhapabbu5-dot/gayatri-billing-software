package com.gayatri.vhms.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "payments")
public class Payment {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "folio_id", nullable = false)
  private Long folioId;

  @Column(name = "booking_id", nullable = false)
  private Long bookingId;

  @Column(nullable = false)
  private BigDecimal amount;

  @Column(nullable = false, length = 40)
  private String method;

  @Column(nullable = false, length = 40)
  private String type;

  @Column(name = "paid_at", nullable = false)
  private Instant paidAt = Instant.now();

  @Column(name = "ref_no", length = 120)
  private String refNo;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "recorded_by")
  private AppUser recordedBy;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt = Instant.now();

  public Long getId() { return id; }
  public Long getFolioId() { return folioId; }
  public void setFolioId(Long folioId) { this.folioId = folioId; }
  public Long getBookingId() { return bookingId; }
  public void setBookingId(Long bookingId) { this.bookingId = bookingId; }
  public BigDecimal getAmount() { return amount; }
  public void setAmount(BigDecimal amount) { this.amount = amount; }
  public String getMethod() { return method; }
  public void setMethod(String method) { this.method = method; }
  public String getType() { return type; }
  public void setType(String type) { this.type = type; }
  public Instant getPaidAt() { return paidAt; }
  public void setPaidAt(Instant paidAt) { this.paidAt = paidAt; }
  public String getRefNo() { return refNo; }
  public void setRefNo(String refNo) { this.refNo = refNo; }
  public AppUser getRecordedBy() { return recordedBy; }
  public void setRecordedBy(AppUser recordedBy) { this.recordedBy = recordedBy; }
}
