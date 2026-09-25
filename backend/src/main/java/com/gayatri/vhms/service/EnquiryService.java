package com.gayatri.vhms.service;

import com.gayatri.vhms.dto.ApiDtos.EnquiryResponse;
import com.gayatri.vhms.dto.ApiDtos.PublicEnquiryRequest;
import com.gayatri.vhms.entity.Booking;
import com.gayatri.vhms.entity.Enquiry;
import com.gayatri.vhms.entity.Folio;
import com.gayatri.vhms.entity.Guest;
import com.gayatri.vhms.entity.Hall;
import com.gayatri.vhms.entity.HallReservation;
import com.gayatri.vhms.repository.BookingRepository;
import com.gayatri.vhms.repository.EnquiryRepository;
import com.gayatri.vhms.repository.FolioRepository;
import com.gayatri.vhms.repository.GuestRepository;
import com.gayatri.vhms.repository.HallRepository;
import com.gayatri.vhms.repository.HallReservationRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class EnquiryService {
  private static final Logger log = LoggerFactory.getLogger(EnquiryService.class);

  private final EnquiryRepository enquiries;
  private final GuestRepository guests;
  private final HallRepository halls;
  private final BookingRepository bookings;
  private final FolioRepository folios;
  private final HallReservationRepository hallReservations;
  private final ReservationConflictService conflicts;
  private final BookingNumberService numbers;

  public EnquiryService(
      EnquiryRepository enquiries,
      GuestRepository guests,
      HallRepository halls,
      BookingRepository bookings,
      FolioRepository folios,
      HallReservationRepository hallReservations,
      ReservationConflictService conflicts,
      BookingNumberService numbers
  ) {
    this.enquiries = enquiries;
    this.guests = guests;
    this.halls = halls;
    this.bookings = bookings;
    this.folios = folios;
    this.hallReservations = hallReservations;
    this.conflicts = conflicts;
    this.numbers = numbers;
  }

  /**
   * Website form submission. Creates (or reuses) the guest, an {@code Enquiry} booking and —
   * when the requested hall resolves and the date is free — a tentative hall reservation.
   * A clash is reported as 409 instead of a fake success so the customer is never told a
   * date is held when it is not.
   */
  @Transactional
  public EnquiryResponse submit(PublicEnquiryRequest req) {
    String name = req.name().trim();
    String phone = blankToNull(req.phone());
    String email = blankToNull(req.email());

    Hall hall = resolveHall(req.hall());
    if (hall != null && req.date() != null) {
      // Lock the hall row first so two simultaneous website submissions cannot both pass.
      halls.lockById(hall.getId());
      conflicts.requireHallFree(hall.getId(), hall.getName(), req.date(), null);
    }

    Guest guest = findOrCreateGuest(name, phone, email);

    Booking booking = new Booking();
    booking.setNumber(numbers.nextEnquiry());
    booking.setGuest(guest);
    booking.setType("Enquiry");
    booking.setSource("Website");
    booking.setEventDate(req.date() == null ? LocalDate.now() : req.date());
    booking.setGuestsExpected(req.guests());
    booking.setNotes(req.message());
    booking.setStatus("Enquiry");
    booking = bookings.save(booking);

    Folio folio = new Folio();
    folio.setBookingId(booking.getId());
    folio.setDiscount(BigDecimal.ZERO);
    folios.save(folio);

    if (hall != null && req.date() != null) {
      HallReservation hr = new HallReservation();
      hr.setBookingId(booking.getId());
      hr.setHall(hall);
      hr.setEventDate(req.date());
      hr.setSlotType("full-day");
      hr.setAmount(BigDecimal.ZERO);
      hr.setStatus("Enquiry");
      hallReservations.save(hr);
    }

    Enquiry e = new Enquiry();
    e.setName(name);
    e.setPhone(phone);
    e.setEmail(email);
    e.setEventDate(req.date());
    e.setHallCode(hall == null ? blankToNull(req.hall()) : hall.getCode());
    e.setGuestsExpected(req.guests());
    e.setMessage(req.message());
    e.setStatus("Open");
    e.setBookingId(booking.getId());
    e.setAgreeHall(Boolean.TRUE.equals(req.agreeHall()));
    e.setAgreeRoom(Boolean.TRUE.equals(req.agreeRoom()));
    e = enquiries.save(e);

    log.info("Website enquiry {} captured as booking {}", e.getId(), booking.getNumber());
    return toEnquiry(e, booking.getNumber());
  }

  @Transactional(readOnly = true)
  public List<EnquiryResponse> list(String status) {
    List<Enquiry> list = (status == null || status.isBlank())
        ? enquiries.findAllByOrderByCreatedAtDesc()
        : enquiries.findByStatusIgnoreCaseOrderByCreatedAtDesc(status.trim());
    Map<Long, String> numbersByBooking = new HashMap<>();
    List<Long> bookingIds = list.stream().map(Enquiry::getBookingId).filter(Objects::nonNull).toList();
    if (!bookingIds.isEmpty()) {
      for (Booking b : bookings.findAllById(bookingIds)) {
        numbersByBooking.put(b.getId(), b.getNumber());
      }
    }
    return list.stream()
        .map(e -> toEnquiry(e, e.getBookingId() == null ? null : numbersByBooking.get(e.getBookingId())))
        .toList();
  }

  /** Accepts a hall code ("IMP"), exact name, or a partial name from the website dropdown. */
  private Hall resolveHall(String raw) {
    String key = blankToNull(raw);
    if (key == null) {
      return null;
    }
    List<Hall> exact = halls.findByCodeOrName(key.trim());
    if (!exact.isEmpty()) {
      return exact.get(0);
    }
    List<Hall> partial = halls.findByNameContains(key.trim());
    return partial.size() == 1 ? partial.get(0) : null;
  }

  private Guest findOrCreateGuest(String name, String phone, String email) {
    if (phone != null) {
      Guest existing = guests.findFirstByPhoneOrderByIdAsc(phone).orElse(null);
      if (existing != null) {
        // Never overwrite desk-curated guest data from a public form; only fill blanks.
        if (blankToNull(existing.getEmail()) == null && email != null) {
          existing.setEmail(email);
          guests.save(existing);
        }
        return existing;
      }
    }
    Guest g = new Guest();
    g.setName(name);
    g.setPhone(phone);
    g.setEmail(email);
    g.setNationality("India");
    return guests.save(g);
  }

  private EnquiryResponse toEnquiry(Enquiry e, String bookingNumber) {
    return new EnquiryResponse(
        e.getId(), e.getName(), e.getPhone(), e.getEmail(), e.getEventDate(),
        e.getHallCode(), e.getGuestsExpected(), e.getMessage(), e.getStatus(),
        e.getBookingId(), bookingNumber, e.isAgreeHall(), e.isAgreeRoom(), e.getCreatedAt()
    );
  }

  @Transactional
  public EnquiryResponse updateStatus(Long id, String status) {
    if (status == null || status.isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Status is required");
    }
    Enquiry e = enquiries.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Enquiry not found"));
    e.setStatus(status.trim());
    e = enquiries.save(e);
    String bookingNumber = e.getBookingId() == null
        ? null
        : bookings.findById(e.getBookingId()).map(Booking::getNumber).orElse(null);
    return toEnquiry(e, bookingNumber);
  }

  private static String blankToNull(String v) {
    return v == null || v.isBlank() ? null : v.trim();
  }
}
