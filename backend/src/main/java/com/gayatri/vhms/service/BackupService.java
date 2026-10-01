package com.gayatri.vhms.service;

import com.gayatri.vhms.dto.ApiDtos.BookingRequest;
import com.gayatri.vhms.dto.ApiDtos.BookingResponse;
import com.gayatri.vhms.dto.ApiDtos.DeskSnapshot;
import com.gayatri.vhms.dto.ApiDtos.ExpenseRequest;
import com.gayatri.vhms.dto.ApiDtos.ExpenseResponse;
import com.gayatri.vhms.dto.ApiDtos.GuestRequest;
import com.gayatri.vhms.dto.ApiDtos.GuestResponse;
import com.gayatri.vhms.dto.ApiDtos.HallResponse;
import com.gayatri.vhms.dto.ApiDtos.PaymentRequest;
import com.gayatri.vhms.dto.ApiDtos.PaymentResponse;
import com.gayatri.vhms.entity.Booking;
import com.gayatri.vhms.repository.BookingRepository;
import com.gayatri.vhms.security.StaffUserDetails;
import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BackupService {
  private final OperationsService ops;
  private final ExpenseService expenses;
  private final BookingRepository bookings;
  private final AuditService audit;

  public BackupService(
      OperationsService ops,
      ExpenseService expenses,
      BookingRepository bookings,
      AuditService audit
  ) {
    this.ops = ops;
    this.expenses = expenses;
    this.bookings = bookings;
    this.audit = audit;
  }

  public record RestoreResult(
      int bookingsAlreadyPresent,
      int bookingsRestored,
      int expensesAlreadyPresent,
      int expensesRestored,
      int paymentsRestored
  ) {}

  @Transactional
  public RestoreResult restore(DeskSnapshot snap, StaffUserDetails actor) {
    int bookingsPresent = 0;
    int bookingsRestored = 0;
    int expensesPresent = 0;
    int expensesRestored = 0;
    int paymentsRestored = 0;
    if (snap == null) {
      return new RestoreResult(0, 0, 0, 0, 0);
    }

    Map<String, Long> hallIds = new HashMap<>();
    for (HallResponse hall : ops.listHalls()) {
      hallIds.put(String.valueOf(hall.code()).toUpperCase(Locale.ROOT), hall.id());
    }
    Map<String, Long> guestIds = new HashMap<>();
    for (GuestResponse guest : ops.listGuests(null)) {
      guestIds.put(guestKey(guest.name(), guest.phone()), guest.id());
    }
    if (snap.guests() != null) {
      for (GuestResponse guest : snap.guests()) {
        String key = guestKey(guest.name(), guest.phone());
        if (guest.name() == null || guest.name().isBlank() || guestIds.containsKey(key)) {
          continue;
        }
        GuestResponse created = ops.createGuest(new GuestRequest(
            guest.name(), guest.phone(), guest.email(), guest.address(), guest.gstin(),
            guest.nationality(), guest.idProofType(), guest.idProofNumber(),
            guest.leadStatus(), guest.leadSource(), guest.notes()
        ));
        guestIds.put(key, created.id());
      }
    }

    List<ExpenseResponse> currentExpenses = expenses.list(null, null);
    if (snap.expenses() != null) {
      for (ExpenseResponse expense : snap.expenses()) {
        boolean exists = currentExpenses.stream().anyMatch(row -> sameExpense(row, expense));
        if (exists) {
          expensesPresent++;
          continue;
        }
        if (expense.amount() == null || expense.description() == null || expense.category() == null) {
          continue;
        }
        expenses.create(new ExpenseRequest(
            expense.category(), expense.description(), expense.amount(), expense.spentOn(),
            expense.paymentMethod(), expense.vendor(), expense.notes(), expense.receiptDocId()
        ), actor);
        expensesRestored++;
      }
    }

    if (snap.bookings() != null) {
      for (BookingResponse booking : snap.bookings()) {
        if (booking.number() == null || booking.number().isBlank()) {
          continue;
        }
        if (bookings.findByNumberIgnoreCase(booking.number()).isPresent()) {
          bookingsPresent++;
          continue;
        }
        Long guestId = guestIds.get(guestKey(booking.guestName(), booking.guestPhone()));
        if (guestId == null && booking.guestName() != null) {
          GuestResponse created = ops.createGuest(new GuestRequest(
              booking.guestName(), booking.guestPhone(), null, null, null, "India", null, null, null, null, null
          ));
          guestId = created.id();
          guestIds.put(guestKey(booking.guestName(), booking.guestPhone()), guestId);
        }
        if (guestId == null) {
          continue;
        }
        List<Long> hallIdList = booking.hallCodes() == null ? List.of() : booking.hallCodes().stream()
            .map(code -> hallIds.get(String.valueOf(code).toUpperCase(Locale.ROOT)))
            .filter(id -> id != null)
            .toList();
        BookingResponse created = ops.createBooking(new BookingRequest(
            guestId, booking.type() == null ? "Event" : booking.type(), "Backup",
            booking.eventDate(), booking.guestsExpected(), booking.notes(), booking.discount(),
            hallIdList, List.of(), booking.slotType() == null ? "full-day" : booking.slotType(),
            null, null, null, null, null, null, null, null, null, null, booking.gstMode()
        ), actor);
        Booking row = bookings.findById(created.id()).orElse(null);
        if (row != null) {
          row.setNumber(booking.number());
          bookings.save(row);
        }
        bookingsRestored++;
      }
    }

    if (snap.payments() != null) {
      List<PaymentResponse> current = ops.listAllPayments();
      for (PaymentResponse payment : snap.payments()) {
        boolean exists = current.stream().anyMatch(row ->
            row.bookingId() != null && row.bookingId().equals(payment.bookingId())
                && sameMoney(row.amount(), payment.amount())
                && String.valueOf(row.refNo()).equals(String.valueOf(payment.refNo()))
        );
        if (exists || payment.bookingId() == null || payment.amount() == null) {
          continue;
        }
        if (bookings.findById(payment.bookingId()).isEmpty()) {
          continue;
        }
        ops.addPayment(payment.bookingId(), new PaymentRequest(
            payment.amount(), payment.method(), payment.type(),
            payment.paidAt() == null ? null : payment.paidAt().atZone(java.time.ZoneOffset.UTC).toLocalDate(),
            payment.refNo()
        ), actor);
        paymentsRestored++;
      }
    }

    audit.record(actor, "backup.restore", "desk",
        "bookings+" + bookingsRestored + " expenses+" + expensesRestored + " payments+" + paymentsRestored);
    return new RestoreResult(bookingsPresent, bookingsRestored, expensesPresent, expensesRestored, paymentsRestored);
  }

  private static boolean sameExpense(ExpenseResponse left, ExpenseResponse right) {
    return String.valueOf(left.description()).equals(String.valueOf(right.description()))
        && sameMoney(left.amount(), right.amount())
        && String.valueOf(left.spentOn()).equals(String.valueOf(right.spentOn()));
  }

  private static boolean sameMoney(BigDecimal left, BigDecimal right) {
    if (left == null || right == null) {
      return left == right;
    }
    return left.compareTo(right) == 0;
  }

  private static String guestKey(String name, String phone) {
    return String.valueOf(name).trim().toLowerCase(Locale.ROOT) + "|" + String.valueOf(phone).trim();
  }
}
