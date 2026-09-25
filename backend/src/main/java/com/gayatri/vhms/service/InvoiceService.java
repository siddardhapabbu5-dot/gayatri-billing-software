package com.gayatri.vhms.service;

import com.gayatri.vhms.dto.ApiDtos.InvoiceResponse;
import com.gayatri.vhms.entity.Booking;
import com.gayatri.vhms.entity.Invoice;
import com.gayatri.vhms.repository.BookingRepository;
import com.gayatri.vhms.repository.InvoiceRepository;
import java.time.Instant;
import java.time.Year;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Staff-issued invoices / receipts persisted in Postgres so every device sees the same numbers.
 * Public website visitors do not generate invoices — only signed-in desk roles with billing access.
 */
@Service
public class InvoiceService {
  private static final Map<String, String> TYPE_PREFIX = Map.ofEntries(
      Map.entry("quotation", "QT"),
      Map.entry("proforma invoice", "PF"),
      Map.entry("tax invoice", "TX"),
      Map.entry("advance receipt", "AR"),
      Map.entry("payment receipt", "RC"),
      Map.entry("credit note", "CN"),
      Map.entry("debit note", "DN"),
      Map.entry("refund receipt", "RF"),
      Map.entry("final invoice", "FN")
  );

  private final InvoiceRepository invoices;
  private final BookingRepository bookings;

  public InvoiceService(InvoiceRepository invoices, BookingRepository bookings) {
    this.invoices = invoices;
    this.bookings = bookings;
  }

  public List<InvoiceResponse> listByBooking(Long bookingId) {
    return invoices.findByBookingIdOrderByIdDesc(bookingId).stream().map(this::toResponse).toList();
  }

  public List<InvoiceResponse> listAll() {
    return invoices.findAllByOrderByIdDesc().stream().map(this::toResponse).toList();
  }

  @Transactional
  public InvoiceResponse issue(Long bookingId, String rawType) {
    Booking booking = bookings.findById(bookingId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));
    String type = normalizeType(rawType);
    Invoice inv = new Invoice();
    inv.setBookingId(booking.getId());
    inv.setType(type);
    inv.setStatus("Issued");
    inv.setNumber(nextNumber(type));
    inv.setIssuedAt(Instant.now());
    return toResponse(invoices.save(inv));
  }

  /** Create a receipt tied to a payment type (Advance / Final / Payment / Refund). */
  @Transactional
  public InvoiceResponse issueForPaymentType(Long bookingId, String paymentType) {
    String type = switch (String.valueOf(paymentType == null ? "" : paymentType).trim().toLowerCase(Locale.ROOT)) {
      case "advance" -> "Advance receipt";
      case "final" -> "Final invoice";
      case "refund", "deposit return" -> "Refund receipt";
      default -> "Payment receipt";
    };
    return issue(bookingId, type);
  }

  static String normalizeType(String rawType) {
    if (rawType == null || rawType.isBlank()) {
      return "Tax invoice";
    }
    String t = rawType.trim();
    // Preserve known labels; otherwise title-case lightly
    String key = t.toLowerCase(Locale.ROOT);
    if (TYPE_PREFIX.containsKey(key)) {
      return switch (key) {
        case "quotation" -> "Quotation";
        case "proforma invoice" -> "Proforma invoice";
        case "tax invoice" -> "Tax invoice";
        case "advance receipt" -> "Advance receipt";
        case "payment receipt" -> "Payment receipt";
        case "credit note" -> "Credit note";
        case "debit note" -> "Debit note";
        case "refund receipt" -> "Refund receipt";
        case "final invoice" -> "Final invoice";
        default -> t;
      };
    }
    return t;
  }

  private synchronized String nextNumber(String type) {
    String prefix = TYPE_PREFIX.getOrDefault(type.toLowerCase(Locale.ROOT), "DOC") + "-" + Year.now() + "-";
    long n = invoices.countByNumberStartingWith(prefix) + 1;
    return prefix + String.format("%05d", n);
  }

  private InvoiceResponse toResponse(Invoice i) {
    return new InvoiceResponse(
        i.getId(), i.getBookingId(), i.getNumber(), i.getType(), i.getStatus(), i.getIssuedAt(), i.getCreatedAt()
    );
  }
}
