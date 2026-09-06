package com.gayatri.vhms.service;

import com.gayatri.vhms.config.RazorpayProperties;
import com.gayatri.vhms.dto.GatewayDtos.CreateOrderRequest;
import com.gayatri.vhms.dto.GatewayDtos.CreateOrderResponse;
import com.gayatri.vhms.dto.GatewayDtos.GatewayConfigResponse;
import com.gayatri.vhms.dto.GatewayDtos.VerifyRequest;
import com.gayatri.vhms.dto.GatewayDtos.VerifyResponse;
import java.nio.charset.StandardCharsets;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.json.JSONObject;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class PaymentGatewayService {
  private final RazorpayProperties props;

  public PaymentGatewayService(RazorpayProperties props) {
    this.props = props;
  }

  public GatewayConfigResponse config() {
    boolean live = props.isLiveReady();
    return new GatewayConfigResponse(
        true,
        live ? "razorpay" : "mock",
        live ? props.getKeyId() : "",
        "INR"
    );
  }

  public CreateOrderResponse createOrder(CreateOrderRequest req) {
    String currency = req.currency() == null || req.currency().isBlank() ? "INR" : req.currency();
    String receipt = req.receipt() == null || req.receipt().isBlank()
        ? "rcpt_" + System.currentTimeMillis()
        : req.receipt();

    if (!props.isLiveReady()) {
      String orderId = "order_mock_" + System.currentTimeMillis();
      return new CreateOrderResponse("mock", orderId, "", req.amountPaise(), currency, receipt);
    }

    try {
      com.razorpay.RazorpayClient client = new com.razorpay.RazorpayClient(props.getKeyId(), props.getKeySecret());
      JSONObject orderRequest = new JSONObject();
      orderRequest.put("amount", req.amountPaise());
      orderRequest.put("currency", currency);
      orderRequest.put("receipt", receipt);
      if (req.notes() != null && !req.notes().isEmpty()) {
        orderRequest.put("notes", new JSONObject(req.notes()));
      }
      com.razorpay.Order order = client.orders.create(orderRequest);
      String orderId = String.valueOf(order.get("id"));
      return new CreateOrderResponse(
          "razorpay",
          orderId,
          props.getKeyId(),
          req.amountPaise(),
          currency,
          receipt
      );
    } catch (Exception e) {
      throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Razorpay order failed: " + e.getMessage());
    }
  }

  public VerifyResponse verify(VerifyRequest req) {
    if (!props.isLiveReady()) {
      if (req.orderId() == null || !req.orderId().startsWith("order_mock_")) {
        // still accept mock payments from frontend mock flow
      }
      return new VerifyResponse(true, "mock", req.orderId(), req.paymentId(), "Mock payment accepted");
    }
    try {
      String payload = req.orderId() + "|" + req.paymentId();
      String expected = hmacSha256(payload, props.getKeySecret());
      if (!expected.equals(req.signature())) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid payment signature");
      }
      return new VerifyResponse(true, "razorpay", req.orderId(), req.paymentId(), "Payment verified");
    } catch (ResponseStatusException e) {
      throw e;
    } catch (Exception e) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Verification error: " + e.getMessage());
    }
  }

  private static String hmacSha256(String data, String secret) throws Exception {
    Mac mac = Mac.getInstance("HmacSHA256");
    mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
    byte[] raw = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
    StringBuilder sb = new StringBuilder();
    for (byte b : raw) sb.append(String.format("%02x", b));
    return sb.toString();
  }
}
