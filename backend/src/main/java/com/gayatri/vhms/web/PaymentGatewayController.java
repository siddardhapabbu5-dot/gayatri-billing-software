package com.gayatri.vhms.web;

import com.gayatri.vhms.dto.GatewayDtos.CreateOrderRequest;
import com.gayatri.vhms.dto.GatewayDtos.CreateOrderResponse;
import com.gayatri.vhms.dto.GatewayDtos.GatewayConfigResponse;
import com.gayatri.vhms.dto.GatewayDtos.VerifyRequest;
import com.gayatri.vhms.dto.GatewayDtos.VerifyResponse;
import com.gayatri.vhms.service.PaymentGatewayService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/payments/gateway")
public class PaymentGatewayController {
  private final PaymentGatewayService gateway;

  public PaymentGatewayController(PaymentGatewayService gateway) {
    this.gateway = gateway;
  }

  @GetMapping("/config")
  public GatewayConfigResponse config() {
    return gateway.config();
  }

  @PostMapping("/order")
  @PreAuthorize("isAuthenticated()")
  public CreateOrderResponse order(@Valid @RequestBody CreateOrderRequest req) {
    return gateway.createOrder(req);
  }

  @PostMapping("/verify")
  @PreAuthorize("isAuthenticated()")
  public VerifyResponse verify(@Valid @RequestBody VerifyRequest req) {
    return gateway.verify(req);
  }
}
