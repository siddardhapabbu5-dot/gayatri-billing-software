package com.gayatri.vhms.repository;

import java.math.BigDecimal;

/** Projection for bulk "money total per booking" lookups. */
public interface BookingTotalRow {
  Long getBookingId();

  BigDecimal getTotal();
}
