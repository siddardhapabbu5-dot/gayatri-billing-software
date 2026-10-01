package com.gayatri.vhms.service;

/** Delivers a one-time code. Returns true only when it left this server (for example by SMS). */
public interface OtpSender {
  boolean deliver(String phone, String code);
}
