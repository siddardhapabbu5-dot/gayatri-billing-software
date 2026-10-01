package com.gayatri.vhms.service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/**
 * Posts the OTP when APP_OTP_SMS_URL is set. The code is not written to the log.
 * With no URL, nothing is sent and the caller may show the code on the sign-in screen.
 */
@Component
public class HttpSmsOtpSender implements OtpSender {
  private final String smsUrl;
  private final String smsKey;
  private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(8)).build();

  public HttpSmsOtpSender(
      @Value("${app.otp.sms-url:}") String smsUrl,
      @Value("${app.otp.sms-key:}") String smsKey
  ) {
    this.smsUrl = smsUrl == null ? "" : smsUrl.trim();
    this.smsKey = smsKey == null ? "" : smsKey.trim();
  }

  @Override
  public boolean deliver(String phone, String code) {
    if (smsUrl.isBlank()) return false;
    String body = """
        {"phone":"91%s","message":"Gayatri Convention password reset OTP is %s. It expires in 5 minutes."}
        """.formatted(phone, code).trim();
    HttpRequest.Builder req = HttpRequest.newBuilder(URI.create(smsUrl))
        .timeout(Duration.ofSeconds(10))
        .header("Content-Type", "application/json")
        .POST(HttpRequest.BodyPublishers.ofString(body));
    if (!smsKey.isBlank()) {
      req.header("Authorization", "Bearer " + smsKey);
    }
    try {
      HttpResponse<String> res = http.send(req.build(), HttpResponse.BodyHandlers.ofString());
      if (res.statusCode() < 200 || res.statusCode() >= 300) {
        throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "OTP could not be sent. Try again.");
      }
      return true;
    } catch (ResponseStatusException ex) {
      throw ex;
    } catch (Exception ex) {
      throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "OTP could not be sent. Try again.");
    }
  }
}
