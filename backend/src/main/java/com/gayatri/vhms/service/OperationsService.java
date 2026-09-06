package com.gayatri.vhms.service;

import com.gayatri.vhms.dto.ApiDtos.BookingRequest;
import com.gayatri.vhms.dto.ApiDtos.BookingResponse;
import com.gayatri.vhms.dto.ApiDtos.GuestRequest;
import com.gayatri.vhms.dto.ApiDtos.GuestResponse;
import com.gayatri.vhms.dto.ApiDtos.HallResponse;
import com.gayatri.vhms.dto.ApiDtos.PaymentRequest;
import com.gayatri.vhms.dto.ApiDtos.PaymentResponse;
import com.gayatri.vhms.dto.ApiDtos.RoomResponse;
import com.gayatri.vhms.dto.ApiDtos.RoomStatusRequest;
import com.gayatri.vhms.entity.AppUser;
import com.gayatri.vhms.entity.Booking;
import com.gayatri.vhms.entity.Folio;
import com.gayatri.vhms.entity.Guest;
import com.gayatri.vhms.entity.Hall;
import com.gayatri.vhms.entity.Payment;
import com.gayatri.vhms.entity.Room;
import com.gayatri.vhms.repository.BookingRepository;
import com.gayatri.vhms.repository.FolioRepository;
import com.gayatri.vhms.repository.GuestRepository;
import com.gayatri.vhms.repository.HallRepository;
import com.gayatri.vhms.repository.PaymentRepository;
import com.gayatri.vhms.repository.RoomRepository;
import com.gayatri.vhms.security.StaffUserDetails;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.Year;
import java.time.ZoneOffset;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class OperationsService {
  private final GuestRepository guests;
  private final HallRepository halls;
  private final RoomRepository rooms;
  private final BookingRepository bookings;
  private final FolioRepository folios;
  private final PaymentRepository payments;

  public OperationsService(
      GuestRepository guests,
      HallRepository halls,
      RoomRepository rooms,
      BookingRepository bookings,
      FolioRepository folios,
      PaymentRepository payments
  ) {
    this.guests = guests;
    this.halls = halls;
    this.rooms = rooms;
    this.bookings = bookings;
    this.folios = folios;
    this.payments = payments;
  }

  public List<GuestResponse> listGuests(String q) {
    List<Guest> list = (q == null || q.isBlank()) ? guests.findAll() : guests.search(q.trim());
    return list.stream().map(this::toGuest).toList();
  }

  @Transactional
  public GuestResponse createGuest(GuestRequest req) {
    Guest g = new Guest();
    applyGuest(g, req);
    return toGuest(guests.save(g));
  }

  @Transactional
  public GuestResponse updateGuest(Long id, GuestRequest req) {
    Guest g = guests.findById(id).orElseThrow(() -> notFound("Guest"));
    applyGuest(g, req);
    return toGuest(guests.save(g));
  }

  public List<HallResponse> listHalls() {
    return halls.findByActiveTrueOrderByNameAsc().stream().map(this::toHall).toList();
  }

  public List<RoomResponse> listRooms() {
    return rooms.findActiveWithType().stream().map(this::toRoom).toList();
  }

  @Transactional
  public RoomResponse updateRoomStatus(Long id, RoomStatusRequest req) {
    Room room = rooms.findById(id).orElseThrow(() -> notFound("Room"));
    room.setStatus(req.status());
    if (req.hkStatus() != null && !req.hkStatus().isBlank()) {
      room.setHkStatus(req.hkStatus());
    }
    return toRoom(rooms.save(room));
  }

  public List<BookingResponse> listBookings(String q) {
    List<Booking> list = (q == null || q.isBlank())
        ? bookings.findByStatusNotOrderByEventDateDescIdDesc("Cancelled")
        : bookings.search(q.trim());
    return list.stream().map(this::toBooking).toList();
  }

  @Transactional(readOnly = true)
  public BookingResponse getBooking(Long id) {
    return toBooking(bookings.findByIdWithGuest(id).orElseThrow(() -> notFound("Booking")));
  }

  @Transactional
  public BookingResponse createBooking(BookingRequest req, StaffUserDetails actor) {
    Guest guest = guests.findById(req.guestId()).orElseThrow(() -> notFound("Guest"));
    Booking b = new Booking();
    b.setNumber(nextBookingNumber());
    b.setGuest(guest);
    b.setType(req.type());
    b.setSource(req.source() == null || req.source().isBlank() ? "Direct" : req.source());
    b.setEventDate(req.eventDate());
    b.setGuestsExpected(req.guestsExpected());
    b.setNotes(req.notes());
    b.setDiscount(nz(req.discount()));
    b.setStatus("Confirmed");
    b.setCreatedBy(actor.getUser());
    b = bookings.save(b);

    Folio folio = new Folio();
    folio.setBookingId(b.getId());
    folio.setDiscount(nz(req.discount()));
    folio = folios.save(folio);

    maybePay(folio, b, req.advanceAmount(), req.advanceMethod(), "Advance", req.advanceDate(), req.advanceRef(), actor.getUser());
    maybePay(folio, b, req.finalAmount(), req.finalMethod(), "Final", req.finalDate(), req.finalRef(), actor.getUser());
    return toBooking(b);
  }

  @Transactional
  public BookingResponse cancelBooking(Long id) {
    Booking b = bookings.findById(id).orElseThrow(() -> notFound("Booking"));
    b.setStatus("Cancelled");
    b.setCancelledAt(Instant.now());
    b.setUpdatedAt(Instant.now());
    Folio folio = folios.findByBookingId(b.getId()).orElse(null);
    if (folio != null) {
      folio.setStatus("Cancelled");
      folios.save(folio);
    }
    return toBooking(bookings.save(b));
  }

  public List<PaymentResponse> listPayments(Long bookingId) {
    return payments.findByBookingIdOrderByPaidAtAsc(bookingId).stream().map(this::toPayment).toList();
  }

  @Transactional
  public PaymentResponse addPayment(Long bookingId, PaymentRequest req, StaffUserDetails actor) {
    Booking b = bookings.findById(bookingId).orElseThrow(() -> notFound("Booking"));
    Folio folio = folios.findByBookingId(bookingId).orElseThrow(() -> notFound("Folio"));
    Payment p = maybePay(
        folio, b, req.amount(), req.method(), req.type(), req.paidOn(), req.refNo(), actor.getUser()
    );
    if (p == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Amount must be greater than zero");
    }
    return toPayment(p);
  }

  private Payment maybePay(
      Folio folio, Booking booking, BigDecimal amount, String method, String type,
      LocalDate paidOn, String ref, AppUser actor
  ) {
    if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
      return null;
    }
    Payment p = new Payment();
    p.setFolioId(folio.getId());
    p.setBookingId(booking.getId());
    p.setAmount(amount);
    p.setMethod(method == null || method.isBlank() ? "Cash" : method);
    p.setType(type == null || type.isBlank() ? "Payment" : type);
    p.setPaidAt(paidOn == null ? Instant.now() : paidOn.atStartOfDay().toInstant(ZoneOffset.UTC));
    p.setRefNo(ref);
    p.setRecordedBy(actor);
    return payments.save(p);
  }

  private String nextBookingNumber() {
    String prefix = "BK-" + Year.now() + "-";
    long n = bookings.countByNumberStartingWith(prefix) + 1;
    return prefix + String.format("%05d", n);
  }

  private void applyGuest(Guest g, GuestRequest req) {
    g.setName(req.name().trim());
    g.setPhone(req.phone());
    g.setEmail(req.email());
    g.setAddress(req.address());
    g.setGstin(req.gstin());
    g.setNationality(req.nationality() == null || req.nationality().isBlank() ? "India" : req.nationality());
    g.setIdProofType(req.idProofType());
    g.setIdProofNumber(req.idProofNumber());
  }

  private GuestResponse toGuest(Guest g) {
    return new GuestResponse(
        g.getId(), g.getName(), g.getPhone(), g.getEmail(), g.getAddress(),
        g.getGstin(), g.getNationality(), g.getIdProofType(), g.getIdProofNumber()
    );
  }

  private HallResponse toHall(Hall h) {
    return new HallResponse(
        h.getId(), h.getCode(), h.getName(), h.getCapacity(),
        h.getHalfDayRate(), h.getFullDayRate(), h.isActive()
    );
  }

  private RoomResponse toRoom(Room r) {
    return new RoomResponse(
        r.getId(), r.getNumber(), r.getFloor(), r.getStatus(), r.getHkStatus(),
        r.getType() == null ? null : r.getType().getId(),
        r.getType() == null ? null : r.getType().getName(),
        r.getType() == null ? null : r.getType().getBaseRate(),
        r.isActive()
    );
  }

  private BookingResponse toBooking(Booking b) {
    Guest g = b.getGuest();
    return new BookingResponse(
        b.getId(), b.getNumber(), g.getId(), g.getName(), g.getPhone(),
        b.getType(), b.getSource(), b.getEventDate(), b.getGuestsExpected(),
        b.getStatus(), b.getNotes(), b.getDiscount(), b.getCreatedAt()
    );
  }

  private PaymentResponse toPayment(Payment p) {
    return new PaymentResponse(
        p.getId(), p.getBookingId(), p.getAmount(), p.getMethod(), p.getType(), p.getPaidAt(), p.getRefNo()
    );
  }

  private static BigDecimal nz(BigDecimal v) {
    return v == null ? BigDecimal.ZERO : v;
  }

  private static ResponseStatusException notFound(String what) {
    return new ResponseStatusException(HttpStatus.NOT_FOUND, what + " not found");
  }
}
