package com.gayatri.vhms.web;

import com.gayatri.vhms.dto.ApiDtos.ExpenseRequest;
import com.gayatri.vhms.dto.ApiDtos.ExpenseResponse;
import com.gayatri.vhms.security.StaffUserDetails;
import com.gayatri.vhms.service.ExpenseService;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/expenses")
@PreAuthorize("hasAuthority('PERM_ALL') or hasAuthority('PERM_EXPENSES')")
public class ExpenseController {
  private final ExpenseService expenses;

  public ExpenseController(ExpenseService expenses) {
    this.expenses = expenses;
  }

  @GetMapping
  public List<ExpenseResponse> list(
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
  ) {
    return expenses.list(from, to);
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public ExpenseResponse create(
      @Valid @RequestBody ExpenseRequest req,
      @AuthenticationPrincipal StaffUserDetails actor
  ) {
    return expenses.create(req, actor);
  }

  /**
   * Only a duty manager or the owner may sign off an expense. Body-less: defaults to
   * verifying, pass {@code ?verified=false} to undo.
   */
  @PutMapping("/{id}/verify")
  @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
  public ExpenseResponse verify(
      @PathVariable Long id,
      @RequestParam(required = false) Boolean verified
  ) {
    return expenses.setVerified(id, verified == null || verified);
  }
}
