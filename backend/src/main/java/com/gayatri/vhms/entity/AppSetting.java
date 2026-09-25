package com.gayatri.vhms.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "app_settings")
public class AppSetting {

  @Id
  @Column(name = "setting_key", length = 80)
  private String key;

  @Column(name = "setting_value", nullable = false, columnDefinition = "TEXT")
  private String value;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt = Instant.now();

  @Column(name = "updated_by")
  private Long updatedBy;

  public String getKey() { return key; }
  public void setKey(String key) { this.key = key; }
  public String getValue() { return value; }
  public void setValue(String value) { this.value = value; }
  public Instant getUpdatedAt() { return updatedAt; }
  public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
  public Long getUpdatedBy() { return updatedBy; }
  public void setUpdatedBy(Long updatedBy) { this.updatedBy = updatedBy; }
}
