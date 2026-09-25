package com.gayatri.vhms.service;

import com.gayatri.vhms.domain.PermissionKeys;
import com.gayatri.vhms.dto.ApiDtos.DeskSnapshot;
import com.gayatri.vhms.dto.ApiDtos.GuestResponse;
import com.gayatri.vhms.dto.ApiDtos.HallResponse;
import com.gayatri.vhms.security.StaffUserDetails;
import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Role-filtered desk sync payload. Housekeeping must not receive payments or guest ID proof;
 * roles without finance permissions must not receive restricted report source data.
 */
@Service
public class DeskSnapshotService {
  private final OperationsService ops;
  private final EnquiryService enquiries;
  private final ExpenseService expenses;
  private final RefundService refunds;
  private final DocumentService documents;
  private final PermissionService permissions;

  public DeskSnapshotService(
      OperationsService ops,
      EnquiryService enquiries,
      ExpenseService expenses,
      RefundService refunds,
      DocumentService documents,
      PermissionService permissions
  ) {
    this.ops = ops;
    this.enquiries = enquiries;
    this.expenses = expenses;
    this.refunds = refunds;
    this.documents = documents;
    this.permissions = permissions;
  }

  @Transactional(readOnly = true)
  public DeskSnapshot build(StaffUserDetails actor) {
    boolean all = permissions.can(actor, PermissionKeys.ALL);
    boolean guests = all || permissions.can(actor, PermissionKeys.GUESTS)
        || permissions.can(actor, PermissionKeys.GUESTS_VIEW)
        || permissions.can(actor, PermissionKeys.GUESTS_EDIT);
    boolean finance = all || permissions.can(actor, PermissionKeys.BILLING)
        || permissions.can(actor, PermissionKeys.PAYMENT_RECORD)
        || permissions.can(actor, PermissionKeys.INVOICE_ISSUE)
        || permissions.can(actor, PermissionKeys.REFUND_REQUEST)
        || permissions.can(actor, PermissionKeys.REPORTS_FINANCE)
        || permissions.can(actor, PermissionKeys.REPORTS_ALL);
    boolean expensesOk = all || permissions.can(actor, PermissionKeys.EXPENSES)
        || permissions.can(actor, PermissionKeys.EXPENSE_CREATE);
    boolean docs = all || permissions.can(actor, PermissionKeys.DOCUMENTS);
    boolean enq = all || permissions.can(actor, PermissionKeys.RESERVATIONS)
        || permissions.can(actor, PermissionKeys.GUESTS)
        || permissions.can(actor, PermissionKeys.BOOKING_CREATE);
    boolean bookings = all || permissions.can(actor, PermissionKeys.RESERVATIONS)
        || permissions.can(actor, PermissionKeys.CALENDAR)
        || permissions.can(actor, PermissionKeys.BOOKING_CREATE)
        || permissions.can(actor, PermissionKeys.BILLING);
    boolean rooms = all || permissions.can(actor, PermissionKeys.ROOMS)
        || permissions.can(actor, PermissionKeys.ROOMS_HOUSEKEEPING);
    boolean halls = all || permissions.can(actor, PermissionKeys.VENUES)
        || permissions.can(actor, PermissionKeys.CALENDAR)
        || permissions.can(actor, PermissionKeys.RESERVATIONS);
    boolean showRates = all || permissions.can(actor, PermissionKeys.PRICES_EDIT)
        || permissions.can(actor, PermissionKeys.VENUES_EDIT)
        || permissions.can(actor, PermissionKeys.VENUES)
        || permissions.can(actor, PermissionKeys.RESERVATIONS)
        || permissions.can(actor, PermissionKeys.BILLING);
    boolean idProof = all || permissions.can(actor, PermissionKeys.GUESTS_EDIT)
        || permissions.can(actor, PermissionKeys.DOCUMENTS);

    List<GuestResponse> guestRows = guests
        ? ops.listGuests(null).stream().map(g -> redactGuest(g, idProof)).toList()
        : List.of();

    List<HallResponse> hallRows = halls
        ? ops.listHalls().stream().map(h -> showRates ? h
            : new HallResponse(h.id(), h.code(), h.name(), h.capacity(), null, null, h.active())).toList()
        : List.of();

    return new DeskSnapshot(
        Instant.now(),
        guestRows,
        hallRows,
        rooms ? ops.listRooms() : List.of(),
        bookings ? ops.listAllBookings() : List.of(),
        finance ? ops.listAllPayments() : List.of(),
        enq ? enquiries.list(null) : List.of(),
        expensesOk ? expenses.list(null, null) : List.of(),
        finance ? refunds.listAll() : List.of(),
        docs ? documents.list(null, null) : List.of(),
        finance ? ops.listInvoices() : List.of()
    );
  }

  private static GuestResponse redactGuest(GuestResponse g, boolean idProof) {
    if (idProof) {
      return g;
    }
    return new GuestResponse(
        g.id(), g.name(), g.phone(), g.email(), g.address(),
        g.gstin(), g.nationality(), null, null
    );
  }
}
