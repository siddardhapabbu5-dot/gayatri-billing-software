package com.gayatri.vhms.service;

import com.gayatri.vhms.dto.ApiDtos.ExpenseRequest;
import com.gayatri.vhms.dto.ApiDtos.ExpenseResponse;
import com.gayatri.vhms.entity.AppUser;
import com.gayatri.vhms.entity.Expense;
import com.gayatri.vhms.repository.ExpenseRepository;
import com.gayatri.vhms.security.StaffUserDetails;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ExpenseService {
  private final ExpenseRepository expenses;

  public ExpenseService(ExpenseRepository expenses) {
    this.expenses = expenses;
  }

  @Transactional(readOnly = true)
  public List<ExpenseResponse> list(LocalDate from, LocalDate to) {
    List<Expense> list = (from == null || to == null)
        ? expenses.findAllByOrderBySpentOnDescIdDesc()
        : expenses.findBySpentOnBetweenOrderBySpentOnDescIdDesc(from, to);
    return list.stream().map(ExpenseService::toExpense).toList();
  }

  @Transactional
  public ExpenseResponse create(ExpenseRequest req, StaffUserDetails actor) {
    if (req.amount() == null || req.amount().compareTo(BigDecimal.ZERO) <= 0) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Amount must be greater than zero");
    }
    Expense e = new Expense();
    e.setCategory(req.category().trim());
    e.setDescription(req.description().trim());
    e.setAmount(req.amount());
    e.setSpentOn(req.spentOn() == null ? LocalDate.now() : req.spentOn());
    e.setPaymentMethod(req.paymentMethod());
    e.setVendor(req.vendor());
    e.setNotes(req.notes());
    e.setReceiptDocId(req.receiptDocId());
    e.setVerified(false);
    e.setCreatedBy(actor == null ? null : actor.getUser());
    return toExpense(expenses.save(e));
  }

  /** Accounts may verify others' expenses; Owner/Manager may verify any. Nobody verifies their own unless Owner. */
  @Transactional
  public ExpenseResponse setVerified(Long id, boolean verified, StaffUserDetails actor) {
    Expense e = expenses.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Expense not found"));
    if (actor != null && e.getCreatedBy() != null
        && e.getCreatedBy().getId().equals(actor.getUser().getId())
        && actor.getRole() != com.gayatri.vhms.domain.StaffRole.ADMIN) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You cannot verify your own expense");
    }
    e.setVerified(verified);
    return toExpense(expenses.save(e));
  }

  static ExpenseResponse toExpense(Expense e) {
    AppUser by = e.getCreatedBy();
    return new ExpenseResponse(
        e.getId(), e.getCategory(), e.getDescription(), e.getAmount(), e.getSpentOn(),
        e.getPaymentMethod(), e.getVendor(), e.getNotes(), e.isVerified(), e.getReceiptDocId(),
        by == null ? null : by.getId(), by == null ? null : by.getFullName(),
        e.getCreatedAt(), e.getUpdatedAt()
    );
  }
}
