package com.gayatri.vhms.service;

import com.gayatri.vhms.repository.HallReservationRepository;
import com.gayatri.vhms.repository.RoomReservationRepository;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/**
 * Double-booking guard. Callers must already hold a pessimistic lock on the hall / room
 * row (see {@code HallRepository#lockById}) so two concurrent transactions cannot both
 * read "free" and then both insert.
 */
@Service
public class ReservationConflictService {
  private final HallReservationRepository hallReservations;
  private final RoomReservationRepository roomReservations;

  public ReservationConflictService(
      HallReservationRepository hallReservations,
      RoomReservationRepository roomReservations
  ) {
    this.hallReservations = hallReservations;
    this.roomReservations = roomReservations;
  }

  public boolean isHallFree(Long hallId, LocalDate eventDate, Long ignoreBookingId) {
    return hallReservations.findClashes(hallId, eventDate, ignoreBookingId).isEmpty();
  }

  public boolean isRoomFree(Long roomId, LocalDate checkIn, LocalDate checkOut, Long ignoreBookingId) {
    return roomReservations.findClashes(roomId, checkIn, checkOut, ignoreBookingId).isEmpty();
  }

  public void requireHallFree(Long hallId, String hallLabel, LocalDate eventDate, Long ignoreBookingId) {
    requireHallFree(hallId, hallLabel, eventDate, ignoreBookingId, "full-day");
  }

  /** Full-day blocks every slot. A timed slot blocks only an overlapping window. */
  public void requireHallFree(
      Long hallId, String hallLabel, LocalDate eventDate, Long ignoreBookingId, String slotType
  ) {
    Window incoming = windowFor(slotType);
    boolean clash = hallReservations.findClashes(hallId, eventDate, ignoreBookingId).stream()
        .anyMatch(row -> windowsOverlap(incoming, windowFor(row.getSlotType())));
    if (clash) {
      throw new ResponseStatusException(
          HttpStatus.CONFLICT,
          hallLabel + " is already booked on " + eventDate + " for " + incoming.label()
              + ". Pick another slot, date, or hall."
      );
    }
  }

  public record Window(LocalTime start, LocalTime end, String label) {}

  public static Window windowFor(String raw) {
    String key = raw == null ? "full-day" : raw.trim().toLowerCase(Locale.ROOT).replace(' ', '-');
    if (key.contains("half")) {
      return new Window(LocalTime.of(9, 0), LocalTime.of(16, 0), "half-day");
    }
    if (key.contains("9:00-am") || key.equals("09:00")) {
      return new Window(LocalTime.of(9, 0), LocalTime.of(12, 0), "9:00 AM");
    }
    if (key.contains("12:00")) {
      return new Window(LocalTime.of(12, 0), LocalTime.of(15, 0), "12:00 PM");
    }
    if (key.contains("3:00") || key.contains("15:00")) {
      return new Window(LocalTime.of(15, 0), LocalTime.of(18, 0), "3:00 PM");
    }
    if (key.contains("6:00") || key.contains("18:00")) {
      return new Window(LocalTime.of(18, 0), LocalTime.of(21, 0), "6:00 PM");
    }
    if (key.contains("9:00-pm") || key.contains("21:00")) {
      return new Window(LocalTime.of(21, 0), LocalTime.of(23, 59), "9:00 PM");
    }
    return new Window(LocalTime.MIN, LocalTime.of(23, 59), "full-day");
  }

  public static boolean windowsOverlap(Window a, Window b) {
    return a.start().isBefore(b.end()) && b.start().isBefore(a.end());
  }

  public void requireRoomFree(
      Long roomId, String roomLabel, LocalDate checkIn, LocalDate checkOut, Long ignoreBookingId
  ) {
    if (!isRoomFree(roomId, checkIn, checkOut, ignoreBookingId)) {
      throw new ResponseStatusException(
          HttpStatus.CONFLICT,
          "Room " + roomLabel + " is already reserved between " + checkIn + " and " + checkOut + "."
      );
    }
  }

  /** Half-open interval overlap: check-out day is free for the next guest. */
  public static boolean overlaps(LocalDate aIn, LocalDate aOut, LocalDate bIn, LocalDate bOut) {
    return aIn.isBefore(bOut) && aOut.isAfter(bIn);
  }
}
