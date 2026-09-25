package com.gayatri.vhms.service;

import com.gayatri.vhms.dto.ApiDtos.DeskSnapshot;
import java.time.Instant;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Single read model the desk UI polls so a phone, tablet and desktop all converge on the
 * same server state. Reads only — every mutation still goes through its own permission-checked
 * endpoint.
 */
@Service
public class DeskSnapshotService {
  private final OperationsService ops;
  private final EnquiryService enquiries;
  private final ExpenseService expenses;
  private final RefundService refunds;
  private final DocumentService documents;

  public DeskSnapshotService(
      OperationsService ops,
      EnquiryService enquiries,
      ExpenseService expenses,
      RefundService refunds,
      DocumentService documents
  ) {
    this.ops = ops;
    this.enquiries = enquiries;
    this.expenses = expenses;
    this.refunds = refunds;
    this.documents = documents;
  }

  @Transactional(readOnly = true)
  public DeskSnapshot build() {
    return new DeskSnapshot(
        Instant.now(),
        ops.listGuests(null),
        ops.listHalls(),
        ops.listRooms(),
        ops.listAllBookings(),
        ops.listAllPayments(),
        enquiries.list(null),
        expenses.list(null, null),
        refunds.listAll(),
        documents.list(null, null),
        ops.listInvoices()
    );
  }
}
