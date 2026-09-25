package com.gayatri.vhms.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "invoices")
public class Invoice {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "booking_id", nullable = false)
  private Long bookingId;

  @Column(nullable = false, unique = true, length = 60)
  private String number;

  @Column(nullable = false, length = 40)
  private String type = "Tax Invoice";

  @Column(nullable = false, length = 40)
  private String status = "Issued";

  @Column(name = "issued_at", nullable = false)
  private Instant issuedAt = Instant.now();

  @Column(name = "created_at", nullable = false)
  private Instant createdAt = Instant.now();

  public Long getId() { return id; }
  public Long getBookingId() { return bookingId; }
  public void setBookingId(Long bookingId) { this.bookingId = bookingId; }
  public String getNumber() { return number; }
  public void setNumber(String number) { this.number = number; }
  public String getType() { return type; }
  public void setType(String type) { this.type = type; }
  public String getStatus() { return status; }
  public void setStatus(String status) { this.status = status; }
  public Instant getIssuedAt() { return issuedAt; }
  public void setIssuedAt(Instant issuedAt) { this.issuedAt = issuedAt; }
  public Instant getCreatedAt() { return createdAt; }
}
