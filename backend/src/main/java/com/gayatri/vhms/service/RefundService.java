package com.gayatri.vhms.service;

import com.gayatri.vhms.dto.ApiDtos.RefundDecisionRequest;
import com.gayatri.vhms.dto.ApiDtos.RefundRequest;
import com.gayatri.vhms.dto.ApiDtos.RefundResponse;
import com.gayatri.vhms.entity.AppUser;
import com.gayatri.vhms.entity.Refund;
import com.gayatri.vhms.repository.BookingRepository;
import com.gayatri.vhms.repository.PaymentRepository;
import com.gayatri.vhms.repository.RefundRepository;
import com.gayatri.vhms.security.StaffUserDetails;
import java.math.BigDecimal;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class RefundService {
  private static final Set<String> DECISIONS = Set.of("Approved", "Paid", "Rejected");

  private final RefundRepository refunds;
  private final BookingRepository bookings;
  private final PaymentRepository payments;
  private final PermissionService permissions;

  public RefundService(
      RefundRepository refunds,
      BookingRepository bookings,
      PaymentRepository payments,
      PermissionService permissions
  ) {
    this.refunds = refunds;
    this.bookings = bookings;
    this.payments = payments;
    this.permissions = permissions;
  }

  @Transactional(readOnly = true)
  public List<RefundResponse> listForBooking(Long bookingId) {
    return refunds.findByBookingIdOrderByIdDesc(bookingId).stream().map(RefundService::toRefund).toList();
  }

  @Transactional(readOnly = true)
  public List<RefundResponse> listAll() {
    return refunds.findAllByOrderByIdDesc().stream().map(RefundService::toRefund).toList();
  }

  @Transactional
  public RefundResponse request(Long bookingId, RefundRequest req, StaffUserDetails actor) {
    if (!bookings.existsById(bookingId)) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found");
    }
    if (req.amount() == null || req.amount().compareTo(BigDecimal.ZERO) <= 0) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Refund amount must be greater than zero");
    }
    if (req.paymentId() != null && !payments.existsById(req.paymentId())) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Payment not found");
    }
    Refund r = new Refund();
    r.setBookingId(bookingId);
    r.setPaymentId(req.paymentId());
    r.setAmount(req.amount());
    r.setReason(req.reason());
    r.setStatus("Pending");
    r.setRequestedBy(actor == null ? null : actor.getUser());
    return toRefund(refunds.save(r));
  }

  /** Approve / pay / reject. Manager is capped by Owner-set refund limit. */
  @Transactional
  public RefundResponse decide(Long id, RefundDecisionRequest body, StaffUserDetails actor) {
    Refund r = refunds.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Refund not found"));
    String decision = normalizeDecision(body == null ? null : body.status());

    boolean canApprove = actor != null && permissions.can(actor, "refund.approve");
    boolean canProcess = actor != null && permissions.can(actor, "refund.process");

    if ("Paid".equals(decision)) {
      if (!"Approved".equalsIgnoreCase(r.getStatus()) && !"Pending".equalsIgnoreCase(r.getStatus())) {
        throw new ResponseStatusException(HttpStatus.CONFLICT, "Refund is already " + r.getStatus());
      }
      // Accounts: pay only already-approved; Owner/Manager may approve+pay in one step
      if (!canApprove) {
        if (!canProcess || !"Approved".equalsIgnoreCase(r.getStatus())) {
          throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only approved refunds can be marked paid");
        }
      }
    } else {
      if (!"Pending".equalsIgnoreCase(r.getStatus())) {
        throw new ResponseStatusException(HttpStatus.CONFLICT, "Refund is already " + r.getStatus());
      }
      if (!canApprove) {
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Missing permission: refund.approve");
      }
    }

    if (actor != null && actor.getRole() == com.gayatri.vhms.domain.StaffRole.MANAGER
        && ("Approved".equals(decision) || ("Paid".equals(decision) && "Pending".equalsIgnoreCase(r.getStatus())))) {
      BigDecimal limit = permissions.managerRefundLimit();
      if (r.getAmount() != null && r.getAmount().compareTo(limit) > 0) {
        throw new ResponseStatusException(
            HttpStatus.FORBIDDEN,
            "Refund exceeds manager limit of " + limit.toPlainString() + "; owner approval required"
        );
      }
    }

    r.setStatus(decision);
    if (body != null && body.note() != null && !body.note().isBlank()) {
      r.setReason(r.getReason() == null ? body.note() : r.getReason() + "\n" + body.note());
    }
    r.setApprovedBy(actor == null ? null : actor.getUser());
    return toRefund(refunds.save(r));
  }

  private static String normalizeDecision(String raw) {
    if (raw == null || raw.isBlank()) {
      return "Approved";
    }
    String key = raw.trim().toLowerCase(Locale.ROOT);
    return DECISIONS.stream()
        .filter(d -> d.toLowerCase(Locale.ROOT).equals(key))
        .findFirst()
        .orElseThrow(() -> new ResponseStatusException(
            HttpStatus.BAD_REQUEST, "Status must be one of Approved, Paid, Rejected"));
  }

  static RefundResponse toRefund(Refund r) {
    AppUser requested = r.getRequestedBy();
    AppUser approved = r.getApprovedBy();
    return new RefundResponse(
        r.getId(), r.getBookingId(), r.getPaymentId(), r.getAmount(), r.getStatus(), r.getReason(),
        requested == null ? null : requested.getId(), requested == null ? null : requested.getFullName(),
        approved == null ? null : approved.getId(), approved == null ? null : approved.getFullName(),
        r.getCreatedAt(), r.getUpdatedAt()
    );
  }
}
