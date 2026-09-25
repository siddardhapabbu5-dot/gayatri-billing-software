package com.gayatri.vhms.service;

import com.gayatri.vhms.repository.HallReservationRepository;
import com.gayatri.vhms.repository.RoomReservationRepository;
import java.time.LocalDate;
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
    if (!isHallFree(hallId, eventDate, ignoreBookingId)) {
      throw new ResponseStatusException(
          HttpStatus.CONFLICT,
          hallLabel + " is already booked on " + eventDate + ". Pick another date or hall."
      );
    }
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
