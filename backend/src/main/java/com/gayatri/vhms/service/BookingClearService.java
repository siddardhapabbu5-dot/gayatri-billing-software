package com.gayatri.vhms.service;

import com.gayatri.vhms.domain.StaffRole;
import com.gayatri.vhms.security.StaffUserDetails;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Removes bookings and the payments that belong to them from the shared database.
 * Halls, rooms, guests, expenses, and staff logins stay.
 */
@Service
public class BookingClearService {
  private final JdbcTemplate jdbc;
  private final AuditService audit;

  public BookingClearService(JdbcTemplate jdbc, AuditService audit) {
    this.jdbc = jdbc;
    this.audit = audit;
  }

  public record ClearResult(int bookingsRemoved, int paymentsRemoved) {}

  @Transactional
  public ClearResult clearAll(StaffUserDetails actor) {
    requireOwner(actor);
    int payments = count("payments");
    int bookings = count("bookings");
    deleteChildren(null);
    jdbc.update("DELETE FROM bookings");
    audit.record(
        actor,
        "bookings.clear",
        "bookings",
        "Removed " + bookings + " bookings and " + payments + " payments"
    );
    return new ClearResult(bookings, payments);
  }

  @Transactional
  public void deleteOne(StaffUserDetails actor, long bookingId) {
    requireOwner(actor);
    Integer found = jdbc.queryForObject("SELECT COUNT(*) FROM bookings WHERE id = ?", Integer.class, bookingId);
    if (found == null || found == 0) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found");
    }
    deleteChildren(bookingId);
    jdbc.update("DELETE FROM bookings WHERE id = ?", bookingId);
    audit.record(actor, "booking.delete", "bookings", "Removed booking " + bookingId + " and its payments");
  }

  private void requireOwner(StaffUserDetails actor) {
    if (actor == null || actor.getRole() != StaffRole.ADMIN) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the owner can clear bookings and payments");
    }
  }

  private int count(String table) {
    Integer n = jdbc.queryForObject("SELECT COUNT(*) FROM " + table, Integer.class);
    return n == null ? 0 : n;
  }

  /** Child rows first so payment and folio foreign keys do not block the delete. */
  private void deleteChildren(Long bookingId) {
    String refunds = bookingId == null ? "DELETE FROM refunds" : "DELETE FROM refunds WHERE booking_id = ?";
    String payments = bookingId == null ? "DELETE FROM payments" : "DELETE FROM payments WHERE booking_id = ?";
    String lines = bookingId == null
        ? "DELETE FROM folio_lines"
        : "DELETE FROM folio_lines WHERE folio_id IN (SELECT id FROM folios WHERE booking_id = ?)";
    String folios = bookingId == null ? "DELETE FROM folios" : "DELETE FROM folios WHERE booking_id = ?";
    String halls = bookingId == null ? "DELETE FROM hall_reservations" : "DELETE FROM hall_reservations WHERE booking_id = ?";
    String rooms = bookingId == null ? "DELETE FROM room_reservations" : "DELETE FROM room_reservations WHERE booking_id = ?";
    String invoices = bookingId == null ? "DELETE FROM invoices" : "DELETE FROM invoices WHERE booking_id = ?";
    String documents = bookingId == null
        ? "UPDATE documents SET booking_id = NULL WHERE booking_id IS NOT NULL"
        : "UPDATE documents SET booking_id = NULL WHERE booking_id = ?";
    String enquiries = bookingId == null
        ? "UPDATE enquiries SET booking_id = NULL WHERE booking_id IS NOT NULL"
        : "UPDATE enquiries SET booking_id = NULL WHERE booking_id = ?";
    if (bookingId == null) {
      jdbc.update(refunds);
      jdbc.update(payments);
      jdbc.update(lines);
      jdbc.update(folios);
      jdbc.update(halls);
      jdbc.update(rooms);
      jdbc.update(invoices);
      jdbc.update(documents);
      jdbc.update(enquiries);
    } else {
      jdbc.update(refunds, bookingId);
      jdbc.update(payments, bookingId);
      jdbc.update(lines, bookingId);
      jdbc.update(folios, bookingId);
      jdbc.update(halls, bookingId);
      jdbc.update(rooms, bookingId);
      jdbc.update(invoices, bookingId);
      jdbc.update(documents, bookingId);
      jdbc.update(enquiries, bookingId);
    }
  }
}
