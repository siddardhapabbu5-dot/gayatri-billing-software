package com.gayatri.vhms.service;

import com.gayatri.vhms.dto.ApiDtos.DocumentResponse;
import com.gayatri.vhms.entity.AppUser;
import com.gayatri.vhms.entity.DocumentEntity;
import com.gayatri.vhms.repository.BookingRepository;
import com.gayatri.vhms.repository.DocumentRepository;
import com.gayatri.vhms.repository.GuestRepository;
import com.gayatri.vhms.security.StaffUserDetails;
import java.nio.file.Paths;
import java.util.List;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Service
public class DocumentService {
  private final DocumentRepository documents;
  private final BookingRepository bookings;
  private final GuestRepository guests;
  private final FileStorageService storage;

  public DocumentService(
      DocumentRepository documents,
      BookingRepository bookings,
      GuestRepository guests,
      FileStorageService storage
  ) {
    this.documents = documents;
    this.bookings = bookings;
    this.guests = guests;
    this.storage = storage;
  }

  @Transactional(readOnly = true)
  public List<DocumentResponse> list(Long bookingId, Long guestId) {
    List<DocumentEntity> list;
    if (bookingId != null) {
      list = documents.findByBookingIdOrderByIdDesc(bookingId);
    } else if (guestId != null) {
      list = documents.findByGuestIdOrderByIdDesc(guestId);
    } else {
      list = documents.findAllByOrderByIdDesc();
    }
    return list.stream().map(DocumentService::toDocument).toList();
  }

  @Transactional
  public DocumentResponse upload(
      MultipartFile file, Long bookingId, Long guestId, String typeCode, StaffUserDetails actor
  ) {
    if (bookingId != null && !bookings.existsById(bookingId)) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found");
    }
    if (guestId != null && !guests.existsById(guestId)) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Guest not found");
    }
    String key = storage.store(file);

    DocumentEntity d = new DocumentEntity();
    d.setBookingId(bookingId);
    d.setGuestId(guestId);
    d.setTypeCode(typeCode == null || typeCode.isBlank() ? "Other" : typeCode.trim());
    d.setFileName(safeName(file.getOriginalFilename()));
    d.setContentType(FileStorageService.normalizeType(file.getContentType()));
    d.setSizeBytes(file.getSize());
    d.setStorageKey(key);
    d.setUploadedBy(actor == null ? null : actor.getUser());
    return toDocument(documents.save(d));
  }

  @Transactional(readOnly = true)
  public DocumentEntity require(Long id) {
    return documents.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Document not found"));
  }

  public Resource stream(DocumentEntity doc) {
    return storage.load(doc.getStorageKey());
  }

  /** Strip any client-supplied path so the stored name is a plain file name. */
  private static String safeName(String raw) {
    if (raw == null || raw.isBlank()) {
      return "upload";
    }
    String name = Paths.get(raw.replace('\\', '/')).getFileName().toString();
    return name.length() > 255 ? name.substring(name.length() - 255) : name;
  }

  static DocumentResponse toDocument(DocumentEntity d) {
    AppUser by = d.getUploadedBy();
    return new DocumentResponse(
        d.getId(), d.getBookingId(), d.getGuestId(), d.getTypeCode(), d.getFileName(),
        d.getContentType(), d.getSizeBytes(),
        by == null ? null : by.getId(), by == null ? null : by.getFullName(),
        d.getCreatedAt()
    );
  }
}
