package com.gayatri.vhms.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "expenses")
public class Expense {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false, length = 80)
  private String category;

  @Column(nullable = false, length = 255)
  private String description;

  @Column(nullable = false)
  private BigDecimal amount = BigDecimal.ZERO;

  @Column(name = "spent_on", nullable = false)
  private LocalDate spentOn;

  @Column(name = "payment_method", length = 40)
  private String paymentMethod;

  @Column(length = 160)
  private String vendor;

  @Column(columnDefinition = "TEXT")
  private String notes;

  @Column(nullable = false)
  private boolean verified = false;

  @Column(name = "receipt_doc_id")
  private Long receiptDocId;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "created_by")
  private AppUser createdBy;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  @PrePersist
  void onCreate() {
    Instant now = Instant.now();
    createdAt = now;
    updatedAt = now;
  }

  @PreUpdate
  void onUpdate() {
    updatedAt = Instant.now();
  }

  public Long getId() { return id; }
  public String getCategory() { return category; }
  public void setCategory(String category) { this.category = category; }
  public String getDescription() { return description; }
  public void setDescription(String description) { this.description = description; }
  public BigDecimal getAmount() { return amount; }
  public void setAmount(BigDecimal amount) { this.amount = amount; }
  public LocalDate getSpentOn() { return spentOn; }
  public void setSpentOn(LocalDate spentOn) { this.spentOn = spentOn; }
  public String getPaymentMethod() { return paymentMethod; }
  public void setPaymentMethod(String paymentMethod) { this.paymentMethod = paymentMethod; }
  public String getVendor() { return vendor; }
  public void setVendor(String vendor) { this.vendor = vendor; }
  public String getNotes() { return notes; }
  public void setNotes(String notes) { this.notes = notes; }
  public boolean isVerified() { return verified; }
  public void setVerified(boolean verified) { this.verified = verified; }
  public Long getReceiptDocId() { return receiptDocId; }
  public void setReceiptDocId(Long receiptDocId) { this.receiptDocId = receiptDocId; }
  public AppUser getCreatedBy() { return createdBy; }
  public void setCreatedBy(AppUser createdBy) { this.createdBy = createdBy; }
  public Instant getCreatedAt() { return createdAt; }
  public Instant getUpdatedAt() { return updatedAt; }
}
