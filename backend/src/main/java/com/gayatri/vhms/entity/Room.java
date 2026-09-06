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

@Entity
@Table(name = "rooms")
public class Room {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;
  @Column(nullable = false, unique = true, length = 40)
  private String number;
  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "type_id")
  private RoomType type;
  @Column(length = 40)
  private String floor;
  @Column(nullable = false, length = 40)
  private String status = "Available";
  @Column(name = "hk_status", nullable = false, length = 40)
  private String hkStatus = "Clean";
  @Column(nullable = false)
  private boolean active = true;
  @Column(name = "created_at", nullable = false)
  private Instant createdAt = Instant.now();

  public Long getId() { return id; }
  public String getNumber() { return number; }
  public RoomType getType() { return type; }
  public String getFloor() { return floor; }
  public String getStatus() { return status; }
  public void setStatus(String status) { this.status = status; }
  public String getHkStatus() { return hkStatus; }
  public void setHkStatus(String hkStatus) { this.hkStatus = hkStatus; }
  public boolean isActive() { return active; }
}
