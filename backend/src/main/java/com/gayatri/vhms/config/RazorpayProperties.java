package com.gayatri.vhms.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.razorpay")
public class RazorpayProperties {
  /** When false, or keys blank, API runs in mock mode. */
  private boolean enabled = false;
  private String keyId = "";
  private String keySecret = "";

  public boolean isEnabled() { return enabled; }
  public void setEnabled(boolean enabled) { this.enabled = enabled; }
  public String getKeyId() { return keyId; }
  public void setKeyId(String keyId) { this.keyId = keyId; }
  public String getKeySecret() { return keySecret; }
  public void setKeySecret(String keySecret) { this.keySecret = keySecret; }

  public boolean isLiveReady() {
    return enabled
        && keyId != null && !keyId.isBlank()
        && keySecret != null && !keySecret.isBlank();
  }
}
