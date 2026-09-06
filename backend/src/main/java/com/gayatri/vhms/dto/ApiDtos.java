package com.gayatri.vhms.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public final class ApiDtos {
  private ApiDtos() {}

  public record GuestRequest(
      @NotBlank String name,
      String phone,
      String email,
      String address,
      String gstin,
      String nationality,
      String idProofType,
      String idProofNumber
  ) {}

  public record GuestResponse(
      Long id, String name, String phone, String email, String address,
      String gstin, String nationality, String idProofType, String idProofNumber
  ) {}

  public record HallResponse(
      Long id, String code, String name, Integer capacity,
      BigDecimal halfDayRate, BigDecimal fullDayRate, boolean active
  ) {}

  public record RoomResponse(
      Long id, String number, String floor, String status, String hkStatus,
      Long typeId, String typeName, BigDecimal baseRate, boolean active
  ) {}

  public record BookingRequest(
      @NotNull Long guestId,
      @NotBlank String type,
      String source,
      @NotNull LocalDate eventDate,
      Integer guestsExpected,
      String notes,
      BigDecimal discount,
      BigDecimal advanceAmount,
      String advanceMethod,
      LocalDate advanceDate,
      String advanceRef,
      BigDecimal finalAmount,
      String finalMethod,
      LocalDate finalDate,
      String finalRef
  ) {}

  public record BookingResponse(
      Long id, String number, Long guestId, String guestName, String guestPhone,
      String type, String source, LocalDate eventDate, Integer guestsExpected,
      String status, String notes, BigDecimal discount, Instant createdAt
  ) {}

  public record PaymentRequest(
      @NotNull BigDecimal amount,
      @NotBlank String method,
      @NotBlank String type,
      LocalDate paidOn,
      String refNo
  ) {}

  public record PaymentResponse(
      Long id, Long bookingId, BigDecimal amount, String method, String type,
      Instant paidAt, String refNo
  ) {}

  public record RoomStatusRequest(@NotBlank String status, String hkStatus) {}
}
