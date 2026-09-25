package com.gayatri.vhms.repository;

/** Projection for bulk "labels per booking" lookups (hall codes, room numbers). */
public interface BookingLabelRow {
  Long getBookingId();

  String getLabel();
}
