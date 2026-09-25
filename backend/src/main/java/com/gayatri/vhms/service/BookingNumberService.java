package com.gayatri.vhms.service;

import com.gayatri.vhms.repository.BookingRepository;
import java.time.Year;
import org.springframework.stereotype.Service;

/**
 * Human-readable booking references. Sequential per prefix per year.
 * Single-writer assumption matches the current single-instance deployment; a clustered
 * deployment should move this to a Postgres sequence.
 */
@Service
public class BookingNumberService {
  private final BookingRepository bookings;

  public BookingNumberService(BookingRepository bookings) {
    this.bookings = bookings;
  }

  public synchronized String next(String kind) {
    String prefix = kind + "-" + Year.now() + "-";
    long n = bookings.countByNumberStartingWith(prefix) + 1;
    return prefix + String.format("%05d", n);
  }

  public String nextBooking() {
    return next("BK");
  }

  public String nextEnquiry() {
    return next("ENQ");
  }
}
