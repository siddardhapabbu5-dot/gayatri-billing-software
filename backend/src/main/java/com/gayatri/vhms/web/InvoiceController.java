package com.gayatri.vhms.web;

import com.gayatri.vhms.dto.ApiDtos.InvoiceIssueRequest;
import com.gayatri.vhms.dto.ApiDtos.InvoiceResponse;
import com.gayatri.vhms.service.InvoiceService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class InvoiceController {
  private final InvoiceService invoices;

  public InvoiceController(InvoiceService invoices) {
    this.invoices = invoices;
  }

  @GetMapping("/invoices")
  @PreAuthorize("hasAuthority('PERM_ALL') or hasAuthority('PERM_BILLING') or hasAuthority('PERM_INVOICE_ISSUE')")
  public List<InvoiceResponse> all() {
    return invoices.listAll();
  }

  @GetMapping("/bookings/{id}/invoices")
  @PreAuthorize("hasAuthority('PERM_ALL') or hasAuthority('PERM_BILLING') or hasAuthority('PERM_INVOICE_ISSUE')")
  public List<InvoiceResponse> forBooking(@PathVariable Long id) {
    return invoices.listByBooking(id);
  }

  @PostMapping("/bookings/{id}/invoices")
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize("hasAuthority('PERM_ALL') or hasAuthority('PERM_INVOICE_ISSUE')")
  public InvoiceResponse issue(@PathVariable Long id, @Valid @RequestBody InvoiceIssueRequest req) {
    return invoices.issue(id, req.type());
  }
}
