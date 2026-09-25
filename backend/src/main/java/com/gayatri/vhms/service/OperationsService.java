package com.gayatri.vhms.service;

import com.gayatri.vhms.dto.ApiDtos.BookingRequest;
import com.gayatri.vhms.dto.ApiDtos.BookingResponse;
import com.gayatri.vhms.dto.ApiDtos.GuestRequest;
import com.gayatri.vhms.dto.ApiDtos.GuestResponse;
import com.gayatri.vhms.dto.ApiDtos.HallResponse;
import com.gayatri.vhms.dto.ApiDtos.InvoiceResponse;
import com.gayatri.vhms.dto.ApiDtos.PaymentRequest;
import com.gayatri.vhms.dto.ApiDtos.PaymentResponse;
import com.gayatri.vhms.dto.ApiDtos.RoomResponse;
import com.gayatri.vhms.dto.ApiDtos.RoomStatusRequest;
import com.gayatri.vhms.entity.AppUser;
import com.gayatri.vhms.entity.Booking;
import com.gayatri.vhms.entity.Folio;
import com.gayatri.vhms.entity.FolioLine;
import com.gayatri.vhms.entity.Guest;
import com.gayatri.vhms.entity.Hall;
import com.gayatri.vhms.entity.HallReservation;
import com.gayatri.vhms.entity.Invoice;
import com.gayatri.vhms.entity.Payment;
import com.gayatri.vhms.entity.Room;
import com.gayatri.vhms.entity.RoomReservation;
import com.gayatri.vhms.repository.BookingLabelRow;
import com.gayatri.vhms.repository.BookingRepository;
import com.gayatri.vhms.repository.BookingTotalRow;
import com.gayatri.vhms.repository.FolioLineRepository;
import com.gayatri.vhms.repository.FolioRepository;
import com.gayatri.vhms.repository.GuestRepository;
import com.gayatri.vhms.repository.HallRepository;
import com.gayatri.vhms.repository.HallReservationRepository;
import com.gayatri.vhms.repository.InvoiceRepository;
import com.gayatri.vhms.repository.PaymentRepository;
import com.gayatri.vhms.repository.RoomRepository;
import com.gayatri.vhms.repository.RoomReservationRepository;
import com.gayatri.vhms.security.StaffUserDetails;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class OperationsService {
  private static final String CANCELLED = "Cancelled";

  private final GuestRepository guests;
  private final HallRepository halls;
  private final RoomRepository rooms;
  private final BookingRepository bookings;
  private final FolioRepository folios;
  private final FolioLineRepository folioLines;
  private final PaymentRepository payments;
  private final HallReservationRepository hallReservations;
  private final RoomReservationRepository roomReservations;
  private final InvoiceRepository invoices;
  private final ReservationConflictService conflicts;
  private final BookingNumberService numbers;
  private final InvoiceService invoiceService;

  public OperationsService(
      GuestRepository guests,
      HallRepository halls,
      RoomRepository rooms,
      BookingRepository bookings,
      FolioRepository folios,
      FolioLineRepository folioLines,
      PaymentRepository payments,
      HallReservationRepository hallReservations,
      RoomReservationRepository roomReservations,
      InvoiceRepository invoices,
      ReservationConflictService conflicts,
      BookingNumberService numbers,
      InvoiceService invoiceService
  ) {
    this.guests = guests;
    this.halls = halls;
    this.rooms = rooms;
    this.bookings = bookings;
    this.folios = folios;
    this.folioLines = folioLines;
    this.payments = payments;
    this.hallReservations = hallReservations;
    this.roomReservations = roomReservations;
    this.invoices = invoices;
    this.conflicts = conflicts;
    this.numbers = numbers;
    this.invoiceService = invoiceService;
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

  @Transactional(readOnly = true)
  public List<BookingResponse> listBookings(String q) {
    List<Booking> list = (q == null || q.isBlank())
        ? bookings.findByStatusNotOrderByEventDateDescIdDesc(CANCELLED)
        : bookings.search(q.trim());
    return toBookings(list);
  }

  @Transactional(readOnly = true)
  public List<BookingResponse> listAllBookings() {
    return toBookings(bookings.findAllWithGuest());
  }

  @Transactional(readOnly = true)
  public BookingResponse getBooking(Long id) {
    return toBooking(bookings.findByIdWithGuest(id).orElseThrow(() -> notFound("Booking")));
  }

  /**
   * Creates the booking, its hall / room reservations, folio and folio lines in a single
   * transaction. Halls and rooms are locked (SELECT ... FOR UPDATE) and conflict-checked
   * before anything is written, so a clash rolls back with 409 and no partial booking.
   */
  @Transactional
  public BookingResponse createBooking(BookingRequest req, StaffUserDetails actor) {
    Guest guest = guests.findById(req.guestId()).orElseThrow(() -> notFound("Guest"));

    String slotType = normalizeSlot(req.slotType());
    LocalDate checkIn = req.roomCheckIn() == null ? req.eventDate() : req.roomCheckIn();
    LocalDate checkOut = req.roomCheckOut() == null ? checkIn.plusDays(1) : req.roomCheckOut();

    List<Long> hallIds = distinctSorted(req.hallIds());
    List<Long> roomIds = distinctSorted(req.roomIds());
    if (!roomIds.isEmpty() && !checkOut.isAfter(checkIn)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Room check-out must be after check-in");
    }

    // Lock in a stable (ascending id) order to keep concurrent multi-hall bookings deadlock-free.
    List<Hall> lockedHalls = new ArrayList<>();
    for (Long hallId : hallIds) {
      lockedHalls.add(halls.lockById(hallId).orElseThrow(() -> notFound("Hall " + hallId)));
    }
    List<Room> lockedRooms = new ArrayList<>();
    for (Long roomId : roomIds) {
      lockedRooms.add(rooms.lockById(roomId).orElseThrow(() -> notFound("Room " + roomId)));
    }
    for (Hall hall : lockedHalls) {
      conflicts.requireHallFree(hall.getId(), hall.getName(), req.eventDate(), null);
    }
    for (Room room : lockedRooms) {
      conflicts.requireRoomFree(room.getId(), room.getNumber(), checkIn, checkOut, null);
    }

    Booking b = new Booking();
    b.setNumber(numbers.nextBooking());
    b.setGuest(guest);
    b.setType(req.type());
    b.setSource(req.source() == null || req.source().isBlank() ? "Direct" : req.source());
    b.setEventDate(req.eventDate());
    b.setGuestsExpected(req.guestsExpected());
    b.setNotes(req.notes());
    b.setDiscount(nz(req.discount()));
    b.setStatus("Confirmed");
    b.setCreatedBy(actor == null ? null : actor.getUser());
    b = bookings.save(b);

    Folio folio = new Folio();
    folio.setBookingId(b.getId());
    folio.setDiscount(nz(req.discount()));
    folio = folios.save(folio);

    for (Hall hall : lockedHalls) {
      BigDecimal rate = hallRate(hall, slotType);
      HallReservation hr = new HallReservation();
      hr.setBookingId(b.getId());
      hr.setHall(hall);
      hr.setEventDate(req.eventDate());
      hr.setSlotType(slotType);
      hr.setAmount(rate);
      hr.setStatus("Booked");
      hallReservations.save(hr);
      addFolioLine(folio, "Hall", hall.getName() + " (" + slotType + ")", BigDecimal.ONE, rate);
    }

    long nights = Math.max(1, ChronoUnit.DAYS.between(checkIn, checkOut));
    for (Room room : lockedRooms) {
      BigDecimal nightly = room.getType() == null ? BigDecimal.ZERO : nz(room.getType().getBaseRate());
      BigDecimal amount = nightly.multiply(BigDecimal.valueOf(nights));
      RoomReservation rr = new RoomReservation();
      rr.setBookingId(b.getId());
      rr.setRoom(room);
      rr.setGuestId(guest.getId());
      rr.setCheckIn(checkIn);
      rr.setCheckOut(checkOut);
      rr.setAmount(amount);
      rr.setStatus("Reserved");
      roomReservations.save(rr);
      addFolioLine(
          folio, "Room", "Room " + room.getNumber() + " x " + nights + (nights == 1 ? " night" : " nights"),
          BigDecimal.valueOf(nights), nightly
      );
    }

    AppUser actorUser = actor == null ? null : actor.getUser();
    maybePay(folio, b, req.advanceAmount(), req.advanceMethod(), "Advance", req.advanceDate(), req.advanceRef(), actorUser);
    maybePay(folio, b, req.finalAmount(), req.finalMethod(), "Final", req.finalDate(), req.finalRef(), actorUser);
    return toBooking(b);
  }

  @Transactional
  public BookingResponse cancelBooking(Long id) {
    Booking b = bookings.findById(id).orElseThrow(() -> notFound("Booking"));
    b.setStatus(CANCELLED);
    b.setCancelledAt(Instant.now());
    b.setUpdatedAt(Instant.now());
    Folio folio = folios.findByBookingId(b.getId()).orElse(null);
    if (folio != null) {
      folio.setStatus(CANCELLED);
      folios.save(folio);
    }
    for (HallReservation hr : hallReservations.findByBookingId(b.getId())) {
      hr.setStatus(CANCELLED);
      hallReservations.save(hr);
    }
    for (RoomReservation rr : roomReservations.findByBookingId(b.getId())) {
      rr.setStatus(CANCELLED);
      roomReservations.save(rr);
    }
    return toBooking(bookings.save(b));
  }

  public List<PaymentResponse> listPayments(Long bookingId) {
    return payments.findByBookingIdOrderByPaidAtAsc(bookingId).stream().map(this::toPayment).toList();
  }

  public List<PaymentResponse> listAllPayments() {
    return payments.findAllByOrderByPaidAtAsc().stream().map(this::toPayment).toList();
  }

  public List<InvoiceResponse> listInvoices() {
    return invoices.findAllByOrderByIdDesc().stream().map(this::toInvoice).toList();
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
    // Persist a matching receipt/invoice so other devices see it via desk snapshot.
    invoiceService.issueForPaymentType(bookingId, p.getType());
    return toPayment(p);
  }

  private void addFolioLine(Folio folio, String category, String description, BigDecimal qty, BigDecimal unitPrice) {
    FolioLine line = new FolioLine();
    line.setFolioId(folio.getId());
    line.setCategory(category);
    line.setDescription(description);
    line.setQty(qty);
    line.setUnitPrice(unitPrice);
    line.setAmount(unitPrice.multiply(qty));
    folioLines.save(line);
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

  static String normalizeSlot(String raw) {
    if (raw == null || raw.isBlank()) {
      return "full-day";
    }
    String key = raw.trim().toLowerCase(Locale.ROOT).replace(' ', '-');
    return key.contains("half") ? "half-day" : key;
  }

  private static BigDecimal hallRate(Hall hall, String slotType) {
    return "half-day".equals(slotType) ? nz(hall.getHalfDayRate()) : nz(hall.getFullDayRate());
  }

  private static List<Long> distinctSorted(List<Long> ids) {
    if (ids == null || ids.isEmpty()) {
      return List.of();
    }
    return ids.stream().filter(Objects::nonNull).distinct().sorted().toList();
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

  public List<BookingResponse> toBookings(List<Booking> list) {
    if (list.isEmpty()) {
      return List.of();
    }
    List<Long> ids = list.stream().map(Booking::getId).toList();
    Map<Long, List<String>> hallCodes = labels(hallReservations.findHallCodes(ids));
    Map<Long, List<String>> roomNumbers = labels(roomReservations.findRoomNumbers(ids));
    Map<Long, BigDecimal> paid = totals(payments.sumByBookingIds(ids));
    Map<Long, Long> folioIds = new HashMap<>();
    for (Folio f : folios.findByBookingIdIn(ids)) {
      folioIds.put(f.getBookingId(), f.getId());
    }
    return list.stream()
        .map(b -> toBooking(b, hallCodes, roomNumbers, paid, folioIds))
        .toList();
  }

  private BookingResponse toBooking(Booking b) {
    return toBookings(List.of(b)).get(0);
  }

  private BookingResponse toBooking(
      Booking b,
      Map<Long, List<String>> hallCodes,
      Map<Long, List<String>> roomNumbers,
      Map<Long, BigDecimal> paid,
      Map<Long, Long> folioIds
  ) {
    Guest g = b.getGuest();
    return new BookingResponse(
        b.getId(), b.getNumber(), g.getId(), g.getName(), g.getPhone(),
        b.getType(), b.getSource(), b.getEventDate(), b.getGuestsExpected(),
        b.getStatus(), b.getNotes(), b.getDiscount(), b.getCreatedAt(),
        hallCodes.getOrDefault(b.getId(), List.of()),
        roomNumbers.getOrDefault(b.getId(), List.of()),
        paid.getOrDefault(b.getId(), BigDecimal.ZERO),
        folioIds.get(b.getId())
    );
  }

  private static Map<Long, List<String>> labels(Collection<BookingLabelRow> rows) {
    Map<Long, List<String>> out = new HashMap<>();
    for (BookingLabelRow row : rows) {
      out.computeIfAbsent(row.getBookingId(), k -> new ArrayList<>()).add(row.getLabel());
    }
    return out;
  }

  private static Map<Long, BigDecimal> totals(Collection<BookingTotalRow> rows) {
    Map<Long, BigDecimal> out = new HashMap<>();
    for (BookingTotalRow row : rows) {
      out.put(row.getBookingId(), nz(row.getTotal()));
    }
    return out;
  }

  private PaymentResponse toPayment(Payment p) {
    return new PaymentResponse(
        p.getId(), p.getBookingId(), p.getAmount(), p.getMethod(), p.getType(), p.getPaidAt(), p.getRefNo()
    );
  }

  private InvoiceResponse toInvoice(Invoice i) {
    return new InvoiceResponse(
        i.getId(), i.getBookingId(), i.getNumber(), i.getType(), i.getStatus(), i.getIssuedAt(), i.getCreatedAt()
    );
  }

  private static BigDecimal nz(BigDecimal v) {
    return v == null ? BigDecimal.ZERO : v;
  }

  private static ResponseStatusException notFound(String what) {
    return new ResponseStatusException(HttpStatus.NOT_FOUND, what + " not found");
  }
}
