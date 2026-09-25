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
import java.time.LocalDate;

@Entity
@Table(name = "hall_reservations")
public class HallReservation {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "booking_id", nullable = false)
  private Long bookingId;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "hall_id", nullable = false)
  private Hall hall;

  @Column(name = "event_date", nullable = false)
  private LocalDate eventDate;

  @Column(name = "slot_type", nullable = false, length = 40)
  private String slotType = "full-day";

  @Column(name = "start_at")
  private Instant startAt;

  @Column(name = "end_at")
  private Instant endAt;

  @Column(nullable = false)
  private BigDecimal amount = BigDecimal.ZERO;

  @Column(nullable = false, length = 40)
  private String status = "Booked";

  @Column(name = "created_at", nullable = false)
  private Instant createdAt = Instant.now();

  public Long getId() { return id; }
  public Long getBookingId() { return bookingId; }
  public void setBookingId(Long bookingId) { this.bookingId = bookingId; }
  public Hall getHall() { return hall; }
  public void setHall(Hall hall) { this.hall = hall; }
  public LocalDate getEventDate() { return eventDate; }
  public void setEventDate(LocalDate eventDate) { this.eventDate = eventDate; }
  public String getSlotType() { return slotType; }
  public void setSlotType(String slotType) { this.slotType = slotType; }
  public Instant getStartAt() { return startAt; }
  public void setStartAt(Instant startAt) { this.startAt = startAt; }
  public Instant getEndAt() { return endAt; }
  public void setEndAt(Instant endAt) { this.endAt = endAt; }
  public BigDecimal getAmount() { return amount; }
  public void setAmount(BigDecimal amount) { this.amount = amount; }
  public String getStatus() { return status; }
  public void setStatus(String status) { this.status = status; }
  public Instant getCreatedAt() { return createdAt; }
}
