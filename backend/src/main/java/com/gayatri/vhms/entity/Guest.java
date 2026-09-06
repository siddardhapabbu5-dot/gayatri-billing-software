package com.gayatri.vhms.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "guests")
public class Guest {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false, length = 160)
  private String name;

  @Column(length = 30)
  private String phone;

  @Column(length = 180)
  private String email;

  @Column(columnDefinition = "TEXT")
  private String address;

  @Column(length = 30)
  private String gstin;

  @Column(length = 80)
  private String nationality = "India";

  @Column(name = "id_proof_type", length = 40)
  private String idProofType;

  @Column(name = "id_proof_number", length = 80)
  private String idProofNumber;

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
  public void setId(Long id) { this.id = id; }
  public String getName() { return name; }
  public void setName(String name) { this.name = name; }
  public String getPhone() { return phone; }
  public void setPhone(String phone) { this.phone = phone; }
  public String getEmail() { return email; }
  public void setEmail(String email) { this.email = email; }
  public String getAddress() { return address; }
  public void setAddress(String address) { this.address = address; }
  public String getGstin() { return gstin; }
  public void setGstin(String gstin) { this.gstin = gstin; }
  public String getNationality() { return nationality; }
  public void setNationality(String nationality) { this.nationality = nationality; }
  public String getIdProofType() { return idProofType; }
  public void setIdProofType(String idProofType) { this.idProofType = idProofType; }
  public String getIdProofNumber() { return idProofNumber; }
  public void setIdProofNumber(String idProofNumber) { this.idProofNumber = idProofNumber; }
  public Instant getCreatedAt() { return createdAt; }
  public Instant getUpdatedAt() { return updatedAt; }
}
