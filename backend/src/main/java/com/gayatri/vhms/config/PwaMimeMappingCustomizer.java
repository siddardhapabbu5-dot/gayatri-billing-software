package com.gayatri.vhms.config;

import org.springframework.boot.web.server.MimeMappings;
import org.springframework.boot.web.server.WebServerFactoryCustomizer;
import org.springframework.boot.web.servlet.server.ConfigurableServletWebServerFactory;
import org.springframework.stereotype.Component;

/** PWA install needs the correct manifest MIME type (not application/octet-stream). */
@Component
public class PwaMimeMappingCustomizer implements WebServerFactoryCustomizer<ConfigurableServletWebServerFactory> {
  @Override
  public void customize(ConfigurableServletWebServerFactory factory) {
    MimeMappings mappings = new MimeMappings(MimeMappings.DEFAULT);
    mappings.add("webmanifest", "application/manifest+json");
    factory.setMimeMappings(mappings);
  }
}
