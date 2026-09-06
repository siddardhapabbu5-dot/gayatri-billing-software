package com.gayatri.vhms.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "room_types")
public class RoomType {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;
  @Column(nullable = false, unique = true, length = 40)
  private String code;
  @Column(nullable = false, length = 120)
  private String name;
  @Column(name = "base_rate", nullable = false)
  private BigDecimal baseRate = BigDecimal.ZERO;
  @Column(name = "extra_bed", nullable = false)
  private BigDecimal extraBed = BigDecimal.ZERO;
  @Column(name = "created_at", nullable = false)
  private Instant createdAt = Instant.now();

  public Long getId() { return id; }
  public String getCode() { return code; }
  public String getName() { return name; }
  public BigDecimal getBaseRate() { return baseRate; }
  public BigDecimal getExtraBed() { return extraBed; }
}
