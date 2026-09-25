package com.gayatri.vhms.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import com.gayatri.vhms.entity.HallReservation;
import com.gayatri.vhms.entity.RoomReservation;
import com.gayatri.vhms.repository.HallReservationRepository;
import com.gayatri.vhms.repository.RoomReservationRepository;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class ConflictCheckTest {

  private static final LocalDate EVENT_DATE = LocalDate.of(2026, 11, 20);

  @Mock
  private HallReservationRepository hallReservations;

  @Mock
  private RoomReservationRepository roomReservations;

  private ReservationConflictService service() {
    return new ReservationConflictService(hallReservations, roomReservations);
  }

  @Test
  void hallIsFreeWhenNoClashingReservationExists() {
    when(hallReservations.findClashes(eq(1L), eq(EVENT_DATE), any())).thenReturn(List.of());

    assertThat(service().isHallFree(1L, EVENT_DATE, null)).isTrue();
  }

  @Test
  void hallRequestFailsWith409WhenAlreadyBooked() {
    when(hallReservations.findClashes(eq(1L), eq(EVENT_DATE), any()))
        .thenReturn(List.of(new HallReservation()));

    assertThatThrownBy(() -> service().requireHallFree(1L, "Imperial Ballroom", EVENT_DATE, null))
        .isInstanceOf(ResponseStatusException.class)
        .satisfies(ex -> {
          ResponseStatusException rse = (ResponseStatusException) ex;
          assertThat(rse.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
          assertThat(rse.getReason()).contains("Imperial Ballroom").contains("2026-11-20");
        });
  }

  @Test
  void roomRequestFailsWith409WhenStayOverlaps() {
    LocalDate checkIn = LocalDate.of(2026, 11, 20);
    LocalDate checkOut = LocalDate.of(2026, 11, 22);
    when(roomReservations.findClashes(eq(7L), eq(checkIn), eq(checkOut), any()))
        .thenReturn(List.of(new RoomReservation()));

    assertThatThrownBy(() -> service().requireRoomFree(7L, "R07", checkIn, checkOut, null))
        .isInstanceOf(ResponseStatusException.class)
        .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
        .isEqualTo(HttpStatus.CONFLICT);
  }

  @Test
  void roomRequestPassesWhenStayDoesNotOverlap() {
    LocalDate checkIn = LocalDate.of(2026, 11, 22);
    LocalDate checkOut = LocalDate.of(2026, 11, 24);
    when(roomReservations.findClashes(eq(7L), eq(checkIn), eq(checkOut), any())).thenReturn(List.of());

    service().requireRoomFree(7L, "R07", checkIn, checkOut, null);
  }

  @Test
  void overlapUsesHalfOpenIntervalsSoCheckoutDayCanBeResold() {
    LocalDate d20 = LocalDate.of(2026, 11, 20);
    LocalDate d22 = LocalDate.of(2026, 11, 22);
    LocalDate d24 = LocalDate.of(2026, 11, 24);

    // 20->22 and 22->24 share only the changeover day: not a conflict.
    assertThat(ReservationConflictService.overlaps(d20, d22, d22, d24)).isFalse();
    // 20->24 fully contains 22->24.
    assertThat(ReservationConflictService.overlaps(d20, d24, d22, d24)).isTrue();
    // Identical stays conflict.
    assertThat(ReservationConflictService.overlaps(d20, d22, d20, d22)).isTrue();
    // A one-night stay inside a longer stay conflicts.
    assertThat(ReservationConflictService.overlaps(d22, d22.plusDays(1), d20, d24)).isTrue();
  }

  @Test
  void slotTypeDefaultsToFullDay() {
    assertThat(OperationsService.normalizeSlot(null)).isEqualTo("full-day");
    assertThat(OperationsService.normalizeSlot("  ")).isEqualTo("full-day");
    assertThat(OperationsService.normalizeSlot("Half Day")).isEqualTo("half-day");
    assertThat(OperationsService.normalizeSlot("half-day")).isEqualTo("half-day");
  }
}
