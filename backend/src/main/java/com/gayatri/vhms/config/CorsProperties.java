package com.gayatri.vhms.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.cors")
public class CorsProperties {
  private String allowedOrigins = "http://localhost:5177";

  public String getAllowedOrigins() { return allowedOrigins; }
  public void setAllowedOrigins(String allowedOrigins) { this.allowedOrigins = allowedOrigins; }
}
