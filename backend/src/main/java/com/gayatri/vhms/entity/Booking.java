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
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "bookings")
public class Booking {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false, unique = true, length = 40)
  private String number;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "guest_id", nullable = false)
  private Guest guest;

  @Column(nullable = false, length = 80)
  private String type;

  @Column(length = 40)
  private String source;

  @Column(name = "event_date", nullable = false)
  private LocalDate eventDate;

  @Column(name = "guests_expected")
  private Integer guestsExpected;

  @Column(nullable = false, length = 40)
  private String status = "Confirmed";

  @Column(columnDefinition = "TEXT")
  private String notes;

  @Column(nullable = false)
  private java.math.BigDecimal discount = java.math.BigDecimal.ZERO;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "created_by")
  private AppUser createdBy;

  @Column(name = "cancelled_at")
  private Instant cancelledAt;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt = Instant.now();

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt = Instant.now();

  public Long getId() { return id; }
  public String getNumber() { return number; }
  public void setNumber(String number) { this.number = number; }
  public Guest getGuest() { return guest; }
  public void setGuest(Guest guest) { this.guest = guest; }
  public String getType() { return type; }
  public void setType(String type) { this.type = type; }
  public String getSource() { return source; }
  public void setSource(String source) { this.source = source; }
  public LocalDate getEventDate() { return eventDate; }
  public void setEventDate(LocalDate eventDate) { this.eventDate = eventDate; }
  public Integer getGuestsExpected() { return guestsExpected; }
  public void setGuestsExpected(Integer guestsExpected) { this.guestsExpected = guestsExpected; }
  public String getStatus() { return status; }
  public void setStatus(String status) { this.status = status; }
  public String getNotes() { return notes; }
  public void setNotes(String notes) { this.notes = notes; }
  public java.math.BigDecimal getDiscount() { return discount; }
  public void setDiscount(java.math.BigDecimal discount) { this.discount = discount; }
  public AppUser getCreatedBy() { return createdBy; }
  public void setCreatedBy(AppUser createdBy) { this.createdBy = createdBy; }
  public Instant getCancelledAt() { return cancelledAt; }
  public void setCancelledAt(Instant cancelledAt) { this.cancelledAt = cancelledAt; }
  public Instant getCreatedAt() { return createdAt; }
  public Instant getUpdatedAt() { return updatedAt; }
  public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
