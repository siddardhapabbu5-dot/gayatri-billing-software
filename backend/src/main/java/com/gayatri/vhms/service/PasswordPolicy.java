package com.gayatri.vhms.service;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

public final class PasswordPolicy {
  private PasswordPolicy() {}

  public static final String RULE =
      "Password must be at least 8 characters and include 1 uppercase letter, 1 number, and 1 special character";

  public static void requireStrong(String password) {
    if (password == null
        || password.length() < 8
        || password.chars().noneMatch(Character::isUpperCase)
        || password.chars().noneMatch(Character::isDigit)
        || password.chars().allMatch(Character::isLetterOrDigit)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, RULE);
    }
  }

  /** Last 10 digits of an Indian mobile, or null when the value is not a mobile number. */
  public static String normalizePhone(String raw) {
    if (raw == null) return null;
    String digits = raw.replaceAll("\\D", "");
    if (digits.length() == 12 && digits.startsWith("91")) digits = digits.substring(2);
    if (digits.length() == 11 && digits.startsWith("0")) digits = digits.substring(1);
    if (digits.length() != 10 || digits.charAt(0) < '6') return null;
    return digits;
  }
}
