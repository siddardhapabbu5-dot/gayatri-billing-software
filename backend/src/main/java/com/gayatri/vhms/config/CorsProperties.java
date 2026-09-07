package com.gayatri.vhms.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.cors")
public class CorsProperties {
  private String allowedOrigins = "http://localhost:*,http://127.0.0.1:*";

  public String getAllowedOrigins() { return allowedOrigins; }
  public void setAllowedOrigins(String allowedOrigins) { this.allowedOrigins = allowedOrigins; }
}
