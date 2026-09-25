package com.gayatri.vhms.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "enquiries")
public class Enquiry {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false, length = 160)
  private String name;

  @Column(length = 30)
  private String phone;

  @Column(length = 180)
  private String email;

  @Column(name = "event_date")
  private LocalDate eventDate;

  @Column(name = "hall_code", length = 40)
  private String hallCode;

  @Column(name = "guests_expected")
  private Integer guestsExpected;

  @Column(columnDefinition = "TEXT")
  private String message;

  @Column(nullable = false, length = 40)
  private String status = "Open";

  @Column(name = "booking_id")
  private Long bookingId;

  @Column(name = "agree_hall", nullable = false)
  private boolean agreeHall = false;

  @Column(name = "agree_room", nullable = false)
  private boolean agreeRoom = false;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt = Instant.now();

  public Long getId() { return id; }
  public String getName() { return name; }
  public void setName(String name) { this.name = name; }
  public String getPhone() { return phone; }
  public void setPhone(String phone) { this.phone = phone; }
  public String getEmail() { return email; }
  public void setEmail(String email) { this.email = email; }
  public LocalDate getEventDate() { return eventDate; }
  public void setEventDate(LocalDate eventDate) { this.eventDate = eventDate; }
  public String getHallCode() { return hallCode; }
  public void setHallCode(String hallCode) { this.hallCode = hallCode; }
  public Integer getGuestsExpected() { return guestsExpected; }
  public void setGuestsExpected(Integer guestsExpected) { this.guestsExpected = guestsExpected; }
  public String getMessage() { return message; }
  public void setMessage(String message) { this.message = message; }
  public String getStatus() { return status; }
  public void setStatus(String status) { this.status = status; }
  public Long getBookingId() { return bookingId; }
  public void setBookingId(Long bookingId) { this.bookingId = bookingId; }
  public boolean isAgreeHall() { return agreeHall; }
  public void setAgreeHall(boolean agreeHall) { this.agreeHall = agreeHall; }
  public boolean isAgreeRoom() { return agreeRoom; }
  public void setAgreeRoom(boolean agreeRoom) { this.agreeRoom = agreeRoom; }
  public Instant getCreatedAt() { return createdAt; }
}
