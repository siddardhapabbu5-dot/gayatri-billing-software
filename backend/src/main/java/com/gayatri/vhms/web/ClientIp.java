package com.gayatri.vhms.web;

import jakarta.servlet.http.HttpServletRequest;

public final class ClientIp {
  private ClientIp() {}

  public static String of(HttpServletRequest request) {
    if (request == null) return "unknown";
    String forwarded = request.getHeader("X-Forwarded-For");
    if (forwarded != null && !forwarded.isBlank()) {
      String first = forwarded.split(",")[0].trim();
      if (!first.isBlank()) return first;
    }
    String real = request.getHeader("X-Real-IP");
    if (real != null && !real.isBlank()) return real.trim();
    String remote = request.getRemoteAddr();
    return remote == null || remote.isBlank() ? "unknown" : remote;
  }
}
