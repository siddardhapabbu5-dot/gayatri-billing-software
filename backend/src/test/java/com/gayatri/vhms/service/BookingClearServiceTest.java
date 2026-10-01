package com.gayatri.vhms.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.gayatri.vhms.domain.StaffRole;
import com.gayatri.vhms.entity.AppUser;
import com.gayatri.vhms.security.StaffUserDetails;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class BookingClearServiceTest {

  @Mock JdbcTemplate jdbc;
  @Mock AuditService audit;
  @InjectMocks BookingClearService service;

  @Test
  void clearAllRemovesBookingsAndPaymentsAndLeavesHalls() {
    when(jdbc.queryForObject(contains("payments"), eq(Integer.class))).thenReturn(4);
    when(jdbc.queryForObject(contains("bookings"), eq(Integer.class))).thenReturn(2);

    BookingClearService.ClearResult result = service.clearAll(owner());

    assertEquals(2, result.bookingsRemoved());
    assertEquals(4, result.paymentsRemoved());
    verify(jdbc).update("DELETE FROM payments");
    verify(jdbc).update("DELETE FROM bookings");
    verify(jdbc, never()).update(contains("halls"));
    verify(jdbc, never()).update(contains("app_users"));
  }

  @Test
  void managerCannotClear() {
    AppUser user = new AppUser();
    user.setId(2L);
    user.setRole(StaffRole.MANAGER);
    assertThrows(ResponseStatusException.class, () -> service.clearAll(new StaffUserDetails(user)));
  }

  private static StaffUserDetails owner() {
    AppUser user = new AppUser();
    user.setId(1L);
    user.setRole(StaffRole.ADMIN);
    return new StaffUserDetails(user);
  }
}
