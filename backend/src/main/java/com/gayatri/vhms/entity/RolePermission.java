package com.gayatri.vhms.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;

@Entity
@Table(name = "role_permissions")
@IdClass(RolePermission.Pk.class)
public class RolePermission {

  @Id
  @Column(nullable = false, length = 40)
  private String role;

  @Id
  @Column(nullable = false, length = 80)
  private String permission;

  @Column(nullable = false)
  private boolean allowed = true;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt = Instant.now();

  @Column(name = "updated_by")
  private Long updatedBy;

  public String getRole() { return role; }
  public void setRole(String role) { this.role = role; }
  public String getPermission() { return permission; }
  public void setPermission(String permission) { this.permission = permission; }
  public boolean isAllowed() { return allowed; }
  public void setAllowed(boolean allowed) { this.allowed = allowed; }
  public Instant getUpdatedAt() { return updatedAt; }
  public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
  public Long getUpdatedBy() { return updatedBy; }
  public void setUpdatedBy(Long updatedBy) { this.updatedBy = updatedBy; }

  public static class Pk implements Serializable {
    private String role;
    private String permission;

    public Pk() {}

    public Pk(String role, String permission) {
      this.role = role;
      this.permission = permission;
    }

    @Override
    public boolean equals(Object o) {
      if (this == o) return true;
      if (!(o instanceof Pk pk)) return false;
      return Objects.equals(role, pk.role) && Objects.equals(permission, pk.permission);
    }

    @Override
    public int hashCode() {
      return Objects.hash(role, permission);
    }
  }
}
