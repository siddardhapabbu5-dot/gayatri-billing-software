package com.gayatri.vhms.web;

import com.gayatri.vhms.dto.ApiDtos.RefundDecisionRequest;
import com.gayatri.vhms.dto.ApiDtos.RefundRequest;
import com.gayatri.vhms.dto.ApiDtos.RefundResponse;
import com.gayatri.vhms.security.StaffUserDetails;
import com.gayatri.vhms.service.RefundService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class RefundController {
  private final RefundService refunds;

  public RefundController(RefundService refunds) {
    this.refunds = refunds;
  }

  @GetMapping("/bookings/{id}/refunds")
  @PreAuthorize("hasAuthority('PERM_ALL') or hasAuthority('PERM_BILLING') or hasAuthority('PERM_REFUND_REQUEST') or hasAuthority('PERM_REFUND_APPROVE') or hasAuthority('PERM_REFUND_PROCESS')")
  public List<RefundResponse> forBooking(@PathVariable Long id) {
    return refunds.listForBooking(id);
  }

  @PostMapping("/bookings/{id}/refunds")
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize("hasAuthority('PERM_ALL') or hasAuthority('PERM_REFUND_REQUEST')")
  public RefundResponse request(
      @PathVariable Long id,
      @Valid @RequestBody RefundRequest req,
      @AuthenticationPrincipal StaffUserDetails actor
  ) {
    return refunds.request(id, req, actor);
  }

  @GetMapping("/refunds")
  @PreAuthorize("hasAuthority('PERM_ALL') or hasAuthority('PERM_BILLING') or hasAuthority('PERM_REFUND_REQUEST') or hasAuthority('PERM_REFUND_APPROVE') or hasAuthority('PERM_REFUND_PROCESS')")
  public List<RefundResponse> all() {
    return refunds.listAll();
  }

  @PostMapping("/refunds/{id}/approve")
  @PreAuthorize("hasAuthority('PERM_ALL') or hasAuthority('PERM_REFUND_APPROVE') or hasAuthority('PERM_REFUND_PROCESS')")
  public RefundResponse approve(
      @PathVariable Long id,
      @RequestParam(required = false) String status,
      @RequestParam(required = false) String note,
      @AuthenticationPrincipal StaffUserDetails actor
  ) {
    return refunds.decide(id, new RefundDecisionRequest(status, note), actor);
  }
}
