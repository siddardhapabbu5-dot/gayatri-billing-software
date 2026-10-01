package com.gayatri.vhms.web;

import com.gayatri.vhms.security.StaffUserDetails;
import com.gayatri.vhms.service.BookingClearService;
import com.gayatri.vhms.service.BookingClearService.ClearResult;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
public class BookingClearController {
  private final BookingClearService clears;

  public BookingClearController(BookingClearService clears) {
    this.clears = clears;
  }

  public record ClearRequest(@NotBlank String confirm) {}

  @PostMapping("/api/admin/ops/clear")
  @PreAuthorize("hasRole('ADMIN')")
  public ClearResult clearAll(
      @Valid @RequestBody ClearRequest body,
      @AuthenticationPrincipal StaffUserDetails actor
  ) {
    if (!"CLEAR".equals(body.confirm())) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Type CLEAR to remove bookings and payments");
    }
    return clears.clearAll(actor);
  }

  @DeleteMapping("/api/bookings/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @PreAuthorize("hasRole('ADMIN')")
  public void deleteOne(@PathVariable Long id, @AuthenticationPrincipal StaffUserDetails actor) {
    clears.deleteOne(actor, id);
  }
}
