package com.gayatri.vhms.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "audit_logs")
public class AuditLog {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "user_id")
  private Long userId;

  @Column(nullable = false, length = 120)
  private String action;

  @Column(length = 120)
  private String entity;

  @Column(columnDefinition = "TEXT")
  private String detail;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  @PrePersist
  void onCreate() {
    if (createdAt == null) {
      createdAt = Instant.now();
    }
  }

  public Long getId() { return id; }
  public Long getUserId() { return userId; }
  public void setUserId(Long userId) { this.userId = userId; }
  public String getAction() { return action; }
  public void setAction(String action) { this.action = action; }
  public String getEntity() { return entity; }
  public void setEntity(String entity) { this.entity = entity; }
  public String getDetail() { return detail; }
  public void setDetail(String detail) { this.detail = detail; }
  public Instant getCreatedAt() { return createdAt; }
}
