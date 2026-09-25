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
      List<Long> hallIds,
      List<Long> roomIds,
      String slotType,
      LocalDate roomCheckIn,
      LocalDate roomCheckOut,
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
      String status, String notes, BigDecimal discount, Instant createdAt,
      List<String> hallCodes, List<String> roomNumbers,
      BigDecimal paymentsTotal, Long folioId
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

  /** Website contact / booking form. No auth — keep the surface small and validated. */
  public record PublicEnquiryRequest(
      @NotBlank String name,
      String phone,
      String email,
      LocalDate date,
      String hall,
      Integer guests,
      String message,
      Boolean agreeHall,
      Boolean agreeRoom
  ) {}

  public record EnquiryResponse(
      Long id, String name, String phone, String email, LocalDate eventDate,
      String hallCode, Integer guestsExpected, String message, String status,
      Long bookingId, String bookingNumber, boolean agreeHall, boolean agreeRoom,
      Instant createdAt
  ) {}

  public record ExpenseRequest(
      @NotBlank String category,
      @NotBlank String description,
      @NotNull BigDecimal amount,
      LocalDate spentOn,
      String paymentMethod,
      String vendor,
      String notes,
      Long receiptDocId
  ) {}

  public record ExpenseResponse(
      Long id, String category, String description, BigDecimal amount, LocalDate spentOn,
      String paymentMethod, String vendor, String notes, boolean verified, Long receiptDocId,
      Long createdById, String createdByName, Instant createdAt, Instant updatedAt
  ) {}

  public record RefundRequest(
      @NotNull BigDecimal amount,
      String reason,
      Long paymentId
  ) {}

  /** Optional body for the approve endpoint: Approved (default) | Paid | Rejected. */
  public record RefundDecisionRequest(String status, String note) {}

  public record RefundResponse(
      Long id, Long bookingId, Long paymentId, BigDecimal amount, String status, String reason,
      Long requestedById, String requestedByName, Long approvedById, String approvedByName,
      Instant createdAt, Instant updatedAt
  ) {}

  public record DocumentResponse(
      Long id, Long bookingId, Long guestId, String typeCode, String fileName,
      String contentType, long sizeBytes, Long uploadedById, String uploadedByName,
      Instant createdAt
  ) {}

  public record InvoiceIssueRequest(@NotBlank String type) {}

  public record InvoiceResponse(
      Long id, Long bookingId, String number, String type, String status,
      Instant issuedAt, Instant createdAt
  ) {}

  /** One-shot read model so phones/tablets/desktops converge on the same server state. */
  public record DeskSnapshot(
      Instant generatedAt,
      List<GuestResponse> guests,
      List<HallResponse> halls,
      List<RoomResponse> rooms,
      List<BookingResponse> bookings,
      List<PaymentResponse> payments,
      List<EnquiryResponse> enquiries,
      List<ExpenseResponse> expenses,
      List<RefundResponse> refunds,
      List<DocumentResponse> documents,
      List<InvoiceResponse> invoices
  ) {}
}
