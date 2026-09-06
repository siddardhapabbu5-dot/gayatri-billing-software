package com.gayatri.vhms.web;

import com.gayatri.vhms.dto.ApiDtos.BookingRequest;
import com.gayatri.vhms.dto.ApiDtos.BookingResponse;
import com.gayatri.vhms.dto.ApiDtos.GuestRequest;
import com.gayatri.vhms.dto.ApiDtos.GuestResponse;
import com.gayatri.vhms.dto.ApiDtos.HallResponse;
import com.gayatri.vhms.dto.ApiDtos.PaymentRequest;
import com.gayatri.vhms.dto.ApiDtos.PaymentResponse;
import com.gayatri.vhms.dto.ApiDtos.RoomResponse;
import com.gayatri.vhms.dto.ApiDtos.RoomStatusRequest;
import com.gayatri.vhms.security.StaffUserDetails;
import com.gayatri.vhms.service.OperationsService;
import jakarta.validation.Valid;
import java.util.List;
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
@RequestMapping("/api")
public class OperationsController {
  private final OperationsService ops;

  public OperationsController(OperationsService ops) {
    this.ops = ops;
  }

  @GetMapping("/guests")
  @PreAuthorize("hasAuthority('PERM_ALL') or hasAuthority('PERM_GUESTS')")
  public List<GuestResponse> guests(@RequestParam(required = false) String q) {
    return ops.listGuests(q);
  }

  @PostMapping("/guests")
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize("hasAuthority('PERM_ALL') or hasAuthority('PERM_GUESTS')")
  public GuestResponse createGuest(@Valid @RequestBody GuestRequest req) {
    return ops.createGuest(req);
  }

  @PutMapping("/guests/{id}")
  @PreAuthorize("hasAuthority('PERM_ALL') or hasAuthority('PERM_GUESTS')")
  public GuestResponse updateGuest(@PathVariable Long id, @Valid @RequestBody GuestRequest req) {
    return ops.updateGuest(id, req);
  }

  @GetMapping("/halls")
  @PreAuthorize("hasAuthority('PERM_ALL') or hasAuthority('PERM_VENUES') or hasAuthority('PERM_RESERVATIONS') or hasAuthority('PERM_CALENDAR')")
  public List<HallResponse> halls() {
    return ops.listHalls();
  }

  @GetMapping("/rooms")
  @PreAuthorize("hasAuthority('PERM_ALL') or hasAuthority('PERM_ROOMS')")
  public List<RoomResponse> rooms() {
    return ops.listRooms();
  }

  @PutMapping("/rooms/{id}/status")
  @PreAuthorize("hasAuthority('PERM_ALL') or hasAuthority('PERM_ROOMS')")
  public RoomResponse roomStatus(@PathVariable Long id, @Valid @RequestBody RoomStatusRequest req) {
    return ops.updateRoomStatus(id, req);
  }

  @GetMapping("/bookings")
  @PreAuthorize("hasAuthority('PERM_ALL') or hasAuthority('PERM_RESERVATIONS') or hasAuthority('PERM_BILLING') or hasAuthority('PERM_CALENDAR')")
  public List<BookingResponse> bookings(@RequestParam(required = false) String q) {
    return ops.listBookings(q);
  }

  @GetMapping("/bookings/{id}")
  @PreAuthorize("hasAuthority('PERM_ALL') or hasAuthority('PERM_RESERVATIONS') or hasAuthority('PERM_BILLING')")
  public BookingResponse booking(@PathVariable Long id) {
    return ops.getBooking(id);
  }

  @PostMapping("/bookings")
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize("hasAuthority('PERM_ALL') or hasAuthority('PERM_RESERVATIONS')")
  public BookingResponse createBooking(
      @Valid @RequestBody BookingRequest req,
      @AuthenticationPrincipal StaffUserDetails actor
  ) {
    return ops.createBooking(req, actor);
  }

  @PostMapping("/bookings/{id}/cancel")
  @PreAuthorize("hasAuthority('PERM_ALL') or hasAuthority('PERM_RESERVATIONS')")
  public BookingResponse cancel(@PathVariable Long id) {
    return ops.cancelBooking(id);
  }

  @GetMapping("/bookings/{id}/payments")
  @PreAuthorize("hasAuthority('PERM_ALL') or hasAuthority('PERM_BILLING')")
  public List<PaymentResponse> payments(@PathVariable Long id) {
    return ops.listPayments(id);
  }

  @PostMapping("/bookings/{id}/payments")
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize("hasAuthority('PERM_ALL') or hasAuthority('PERM_BILLING')")
  public PaymentResponse addPayment(
      @PathVariable Long id,
      @Valid @RequestBody PaymentRequest req,
      @AuthenticationPrincipal StaffUserDetails actor
  ) {
    return ops.addPayment(id, req, actor);
  }
}
