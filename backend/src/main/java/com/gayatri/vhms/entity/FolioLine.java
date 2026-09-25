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
@Table(name = "folio_lines")
public class FolioLine {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "folio_id", nullable = false)
  private Long folioId;

  @Column(nullable = false, length = 40)
  private String category;

  @Column(nullable = false, length = 255)
  private String description;

  @Column(nullable = false)
  private BigDecimal qty = BigDecimal.ONE;

  @Column(name = "unit_price", nullable = false)
  private BigDecimal unitPrice = BigDecimal.ZERO;

  @Column(nullable = false)
  private BigDecimal amount = BigDecimal.ZERO;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt = Instant.now();

  public Long getId() { return id; }
  public Long getFolioId() { return folioId; }
  public void setFolioId(Long folioId) { this.folioId = folioId; }
  public String getCategory() { return category; }
  public void setCategory(String category) { this.category = category; }
  public String getDescription() { return description; }
  public void setDescription(String description) { this.description = description; }
  public BigDecimal getQty() { return qty; }
  public void setQty(BigDecimal qty) { this.qty = qty; }
  public BigDecimal getUnitPrice() { return unitPrice; }
  public void setUnitPrice(BigDecimal unitPrice) { this.unitPrice = unitPrice; }
  public BigDecimal getAmount() { return amount; }
  public void setAmount(BigDecimal amount) { this.amount = amount; }
  public Instant getCreatedAt() { return createdAt; }
}
