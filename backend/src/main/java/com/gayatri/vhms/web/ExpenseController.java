package com.gayatri.vhms.web;

import com.gayatri.vhms.dto.ApiDtos.ExpenseRequest;
import com.gayatri.vhms.dto.ApiDtos.ExpenseResponse;
import com.gayatri.vhms.security.StaffUserDetails;
import com.gayatri.vhms.service.ExpenseService;
import com.gayatri.vhms.service.PermissionService;
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
@PreAuthorize("hasAuthority('PERM_ALL') or hasAuthority('PERM_EXPENSES') or hasAuthority('PERM_EXPENSE_CREATE') or hasAuthority('PERM_EXPENSE_VERIFY')")
public class ExpenseController {
  private final ExpenseService expenses;
  private final PermissionService permissions;

  public ExpenseController(ExpenseService expenses, PermissionService permissions) {
    this.expenses = expenses;
    this.permissions = permissions;
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
  @PreAuthorize("hasAuthority('PERM_ALL') or hasAuthority('PERM_EXPENSE_CREATE') or hasAuthority('PERM_EXPENSES')")
  public ExpenseResponse create(
      @Valid @RequestBody ExpenseRequest req,
      @AuthenticationPrincipal StaffUserDetails actor
  ) {
    return expenses.create(req, actor);
  }

  @PutMapping("/{id}/verify")
  @PreAuthorize("hasAuthority('PERM_ALL') or hasAuthority('PERM_EXPENSE_VERIFY')")
  public ExpenseResponse verify(
      @PathVariable Long id,
      @RequestParam(required = false) Boolean verified,
      @AuthenticationPrincipal StaffUserDetails actor
  ) {
    permissions.require(actor, "expense.verify");
    return expenses.setVerified(id, verified == null || verified, actor);
  }
}
