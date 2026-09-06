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
@Table(name = "halls")
public class Hall {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false, unique = true, length = 40)
  private String code;

  @Column(nullable = false, length = 120)
  private String name;

  private Integer capacity;

  @Column(name = "half_day_rate", nullable = false)
  private BigDecimal halfDayRate = BigDecimal.ZERO;

  @Column(name = "full_day_rate", nullable = false)
  private BigDecimal fullDayRate = BigDecimal.ZERO;

  @Column(nullable = false)
  private boolean active = true;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt = Instant.now();

  public Long getId() { return id; }
  public String getCode() { return code; }
  public void setCode(String code) { this.code = code; }
  public String getName() { return name; }
  public void setName(String name) { this.name = name; }
  public Integer getCapacity() { return capacity; }
  public void setCapacity(Integer capacity) { this.capacity = capacity; }
  public BigDecimal getHalfDayRate() { return halfDayRate; }
  public void setHalfDayRate(BigDecimal halfDayRate) { this.halfDayRate = halfDayRate; }
  public BigDecimal getFullDayRate() { return fullDayRate; }
  public void setFullDayRate(BigDecimal fullDayRate) { this.fullDayRate = fullDayRate; }
  public boolean isActive() { return active; }
  public void setActive(boolean active) { this.active = active; }
}
