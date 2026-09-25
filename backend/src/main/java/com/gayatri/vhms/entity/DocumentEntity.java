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

/**
 * Uploaded file metadata. Named {@code DocumentEntity} so it does not clash with
 * {@code org.w3c.dom.Document} / Spring's document abstractions.
 */
@Entity
@Table(name = "documents")
public class DocumentEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "booking_id")
  private Long bookingId;

  @Column(name = "guest_id")
  private Long guestId;

  @Column(name = "type_code", nullable = false, length = 60)
  private String typeCode = "Other";

  @Column(name = "file_name", nullable = false, length = 255)
  private String fileName;

  @Column(name = "content_type", length = 120)
  private String contentType;

  @Column(name = "size_bytes", nullable = false)
  private long sizeBytes;

  @Column(name = "storage_key", nullable = false, length = 255)
  private String storageKey;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "uploaded_by")
  private AppUser uploadedBy;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt = Instant.now();

  public Long getId() { return id; }
  public Long getBookingId() { return bookingId; }
  public void setBookingId(Long bookingId) { this.bookingId = bookingId; }
  public Long getGuestId() { return guestId; }
  public void setGuestId(Long guestId) { this.guestId = guestId; }
  public String getTypeCode() { return typeCode; }
  public void setTypeCode(String typeCode) { this.typeCode = typeCode; }
  public String getFileName() { return fileName; }
  public void setFileName(String fileName) { this.fileName = fileName; }
  public String getContentType() { return contentType; }
  public void setContentType(String contentType) { this.contentType = contentType; }
  public long getSizeBytes() { return sizeBytes; }
  public void setSizeBytes(long sizeBytes) { this.sizeBytes = sizeBytes; }
  public String getStorageKey() { return storageKey; }
  public void setStorageKey(String storageKey) { this.storageKey = storageKey; }
  public AppUser getUploadedBy() { return uploadedBy; }
  public void setUploadedBy(AppUser uploadedBy) { this.uploadedBy = uploadedBy; }
  public Instant getCreatedAt() { return createdAt; }
}
