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
@Table(name = "room_reservations")
public class RoomReservation {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "booking_id", nullable = false)
  private Long bookingId;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "room_id", nullable = false)
  private Room room;

  @Column(name = "guest_id")
  private Long guestId;

  @Column(name = "check_in", nullable = false)
  private LocalDate checkIn;

  @Column(name = "check_out", nullable = false)
  private LocalDate checkOut;

  @Column(name = "extra_bed", nullable = false)
  private int extraBed = 0;

  @Column(nullable = false)
  private int children = 0;

  @Column(nullable = false)
  private BigDecimal amount = BigDecimal.ZERO;

  @Column(nullable = false, length = 40)
  private String status = "Reserved";

  @Column(name = "created_at", nullable = false)
  private Instant createdAt = Instant.now();

  public Long getId() { return id; }
  public Long getBookingId() { return bookingId; }
  public void setBookingId(Long bookingId) { this.bookingId = bookingId; }
  public Room getRoom() { return room; }
  public void setRoom(Room room) { this.room = room; }
  public Long getGuestId() { return guestId; }
  public void setGuestId(Long guestId) { this.guestId = guestId; }
  public LocalDate getCheckIn() { return checkIn; }
  public void setCheckIn(LocalDate checkIn) { this.checkIn = checkIn; }
  public LocalDate getCheckOut() { return checkOut; }
  public void setCheckOut(LocalDate checkOut) { this.checkOut = checkOut; }
  public int getExtraBed() { return extraBed; }
  public void setExtraBed(int extraBed) { this.extraBed = extraBed; }
  public int getChildren() { return children; }
  public void setChildren(int children) { this.children = children; }
  public BigDecimal getAmount() { return amount; }
  public void setAmount(BigDecimal amount) { this.amount = amount; }
  public String getStatus() { return status; }
  public void setStatus(String status) { this.status = status; }
  public Instant getCreatedAt() { return createdAt; }
}
