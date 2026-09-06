package com.gayatri.vhms.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.Map;

public final class GatewayDtos {
  private GatewayDtos() {}

  public record GatewayConfigResponse(
      boolean enabled,
      String mode,
      String keyId,
      String currency
  ) {}

  public record CreateOrderRequest(
      @NotNull @Min(100) Long amountPaise,
      String currency,
      String receipt,
      Map<String, String> notes
  ) {}

  public record CreateOrderResponse(
      String mode,
      String orderId,
      String keyId,
      long amountPaise,
      String currency,
      String receipt
  ) {}

  public record VerifyRequest(
      @NotBlank String orderId,
      @NotBlank String paymentId,
      String signature
  ) {}

  public record VerifyResponse(
      boolean verified,
      String mode,
      String orderId,
      String paymentId,
      String message
  ) {}
}
