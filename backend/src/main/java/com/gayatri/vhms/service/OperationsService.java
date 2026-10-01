package com.gayatri.vhms.service;

import com.gayatri.vhms.dto.ApiDtos.BookingRequest;
import com.gayatri.vhms.dto.ApiDtos.ChargeLineRequest;
import com.gayatri.vhms.dto.ApiDtos.FolioLineResponse;
import com.gayatri.vhms.dto.ApiDtos.BookingResponse;
import com.gayatri.vhms.dto.ApiDtos.BookingUpdateRequest;
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
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class OperationsService {
  private static final String CANCELLED = "Cancelled";
  private static final Set<String> EXTRA_CATEGORIES = Set.of("Power", "Security", "Cleaning", "Dumping", "Other");
  private static final ZoneId HALL_ZONE = ZoneId.of("Asia/Kolkata");

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
  private final AuditService audit;
  private final StaffNoticeService notices;

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
      InvoiceService invoiceService,
      AuditService audit,
      StaffNoticeService notices
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
    this.audit = audit;
    this.notices = notices;
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
      conflicts.requireHallFree(hall.getId(), hall.getName(), req.eventDate(), null, slotType);
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
    b.setGstMode("with".equalsIgnoreCase(req.gstMode()) ? "with" : "without");
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
      applySlotWindow(hr, req.eventDate(), slotType);
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
    if ("with".equals(b.getGstMode())) addGstLine(folio);

    AppUser actorUser = actor == null ? null : actor.getUser();
    maybePay(folio, b, req.advanceAmount(), req.advanceMethod(), "Advance", req.advanceDate(), req.advanceRef(), actorUser);
    maybePay(folio, b, req.finalAmount(), req.finalMethod(), "Final", req.finalDate(), req.finalRef(), actorUser);
    audit.record(actor, "booking.create", "bookings", b.getNumber() + " " + slotType);
    notices.post("New booking", b.getNumber() + " · " + guest.getName() + " · " + req.eventDate());
    return toBooking(b);
  }

  @Transactional
  public BookingResponse setGstMode(Long id, String mode) {
    Booking b = bookings.findById(id).orElseThrow(() -> notFound("Booking"));
    String next = "with".equalsIgnoreCase(mode) ? "with" : "without";
    b.setGstMode(next);
    b.setUpdatedAt(Instant.now());
    Folio folio = folios.findByBookingId(b.getId()).orElseThrow(() -> notFound("Folio"));
    for (FolioLine line : folioLines.findByFolioIdOrderByIdAsc(folio.getId())) {
      if ("GST".equals(line.getCategory())) folioLines.delete(line);
    }
    folioLines.flush();
    if ("with".equals(next)) addGstLine(folio);
    bookings.save(b);
    return toBooking(b);
  }

  @Transactional
  public BookingResponse replaceExtras(Long id, List<ChargeLineRequest> lines, StaffUserDetails actor) {
    Booking b = bookings.findById(id).orElseThrow(() -> notFound("Booking"));
    Folio folio = folios.findByBookingId(b.getId()).orElseThrow(() -> notFound("Folio"));
    for (FolioLine line : folioLines.findByFolioIdOrderByIdAsc(folio.getId())) {
      if (EXTRA_CATEGORIES.contains(line.getCategory()) || "GST".equals(line.getCategory())) {
        folioLines.delete(line);
      }
    }
    folioLines.flush();
    if (lines != null) {
      for (ChargeLineRequest row : lines) {
        String category = canonicalExtra(row == null ? null : row.category());
        if (category == null) continue;
        BigDecimal qty = row.qty() == null || row.qty().signum() <= 0 ? BigDecimal.ONE : row.qty();
        BigDecimal unit = nz(row.unitPrice());
        if (unit.signum() <= 0) continue;
        String description = row.description() == null || row.description().isBlank() ? category : row.description().trim();
        if (description.length() > 255) description = description.substring(0, 255);
        addFolioLine(folio, category, description, qty, unit.setScale(2, RoundingMode.HALF_UP));
      }
    }
    if ("with".equalsIgnoreCase(b.getGstMode())) addGstLine(folio);
    b.setUpdatedAt(Instant.now());
    bookings.save(b);
    audit.record(actor, "booking.extras", "bookings", b.getNumber());
    return toBooking(b);
  }

  public List<FolioLineResponse> listExtraLines() {
    Map<Long, Long> bookingOfFolio = new HashMap<>();
    for (Folio folio : folios.findAll()) bookingOfFolio.put(folio.getId(), folio.getBookingId());
    List<FolioLineResponse> out = new ArrayList<>();
    for (FolioLine line : folioLines.findAll()) {
      if (!EXTRA_CATEGORIES.contains(line.getCategory())) continue;
      out.add(new FolioLineResponse(
          line.getId(),
          bookingOfFolio.get(line.getFolioId()),
          line.getFolioId(),
          line.getCategory(),
          line.getDescription(),
          line.getQty(),
          line.getUnitPrice(),
          line.getAmount()
      ));
    }
    return out;
  }

  private static String canonicalExtra(String raw) {
    if (raw == null || raw.isBlank()) return null;
    for (String category : EXTRA_CATEGORIES) {
      if (category.equalsIgnoreCase(raw.trim())) return category;
    }
    return null;
  }

  private void addGstLine(Folio folio) {
    BigDecimal base = folioLines.findByFolioIdOrderByIdAsc(folio.getId()).stream()
        .filter(line -> !"GST".equals(line.getCategory()))
        .map(line -> nz(line.getAmount()))
        .reduce(BigDecimal.ZERO, BigDecimal::add);
    BigDecimal gst = base.multiply(new BigDecimal("0.18")).setScale(0, RoundingMode.HALF_UP);
    if (gst.signum() > 0) addFolioLine(folio, "GST", "GST 18%", BigDecimal.ONE, gst);
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

  @Transactional
  public BookingResponse updateBooking(Long id, BookingUpdateRequest req) {
    Booking b = bookings.findById(id).orElseThrow(() -> notFound("Booking"));
    if (CANCELLED.equalsIgnoreCase(b.getStatus())) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Cancelled bookings cannot be edited");
    }
    if (req.eventDate() != null && !req.eventDate().equals(b.getEventDate())) {
      for (HallReservation hr : hallReservations.findByBookingId(b.getId())) {
        conflicts.requireHallFree(
            hr.getHall().getId(), hr.getHall().getName(), req.eventDate(), b.getId(), hr.getSlotType()
        );
        hr.setEventDate(req.eventDate());
        applySlotWindow(hr, req.eventDate(), hr.getSlotType());
        hallReservations.save(hr);
      }
      b.setEventDate(req.eventDate());
    }
    if (req.guestsExpected() != null) {
      b.setGuestsExpected(req.guestsExpected());
    }
    if (req.notes() != null) {
      b.setNotes(req.notes());
    }
    b.setUpdatedAt(Instant.now());
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
    audit.record(actor, "payment.receive", "payments", b.getNumber() + " " + p.getAmount());
    notices.post("Payment received", b.getNumber() + " · ₹" + p.getAmount().toPlainString());
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
    return "full-day".equals(slotType) ? nz(hall.getFullDayRate()) : nz(hall.getHalfDayRate());
  }

  private static void applySlotWindow(HallReservation hr, LocalDate day, String slotType) {
    ReservationConflictService.Window window = ReservationConflictService.windowFor(slotType);
    hr.setStartAt(day.atTime(window.start()).atZone(HALL_ZONE).toInstant());
    hr.setEndAt(day.atTime(window.end()).atZone(HALL_ZONE).toInstant());
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
    if (req.leadStatus() != null) g.setLeadStatus(req.leadStatus().isBlank() ? null : req.leadStatus().trim());
    if (req.leadSource() != null) g.setLeadSource(req.leadSource().isBlank() ? null : req.leadSource().trim());
    if (req.notes() != null) g.setNotes(req.notes().isBlank() ? null : req.notes().trim());
  }

  private GuestResponse toGuest(Guest g) {
    return new GuestResponse(
        g.getId(), g.getName(), g.getPhone(), g.getEmail(), g.getAddress(),
        g.getGstin(), g.getNationality(), g.getIdProofType(), g.getIdProofNumber(),
        g.getLeadStatus(), g.getLeadSource(), g.getNotes()
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
    Map<Long, String> slots = new HashMap<>();
    for (BookingLabelRow row : hallReservations.findSlotTypes(ids)) {
      slots.putIfAbsent(row.getBookingId(), row.getLabel());
    }
    Map<Long, BigDecimal> paid = totals(payments.sumByBookingIds(ids));
    Map<Long, Long> folioIds = new HashMap<>();
    Map<Long, BigDecimal> charges = new HashMap<>();
    List<Folio> folioRows = folios.findByBookingIdIn(ids);
    for (Folio f : folioRows) {
      folioIds.put(f.getBookingId(), f.getId());
    }
    if (!folioIds.isEmpty()) {
      Map<Long, BigDecimal> lineTotals = totals(folioLines.sumByFolioIds(folioIds.values()));
      for (Folio f : folioRows) {
        BigDecimal lines = lineTotals.getOrDefault(f.getId(), BigDecimal.ZERO);
        BigDecimal net = lines.subtract(nz(f.getDiscount()));
        charges.put(f.getBookingId(), net.signum() < 0 ? BigDecimal.ZERO : net);
      }
    }
    return list.stream()
        .map(b -> toBooking(b, hallCodes, roomNumbers, paid, charges, folioIds, slots))
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
      Map<Long, BigDecimal> charges,
      Map<Long, Long> folioIds,
      Map<Long, String> slots
  ) {
    Guest g = b.getGuest();
    return new BookingResponse(
        b.getId(), b.getNumber(), g.getId(), g.getName(), g.getPhone(),
        b.getType(), b.getSource(), b.getEventDate(), b.getGuestsExpected(),
        b.getStatus(), b.getNotes(), b.getDiscount(), b.getCreatedAt(),
        hallCodes.getOrDefault(b.getId(), List.of()),
        roomNumbers.getOrDefault(b.getId(), List.of()),
        paid.getOrDefault(b.getId(), BigDecimal.ZERO),
        folioIds.get(b.getId()),
        charges.getOrDefault(b.getId(), BigDecimal.ZERO),
        slots.getOrDefault(b.getId(), "full-day"),
        "with".equalsIgnoreCase(b.getGstMode()) ? "with" : "without"
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
