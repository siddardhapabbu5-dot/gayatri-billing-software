package com.gayatri.vhms.repository;

import com.gayatri.vhms.entity.Invoice;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InvoiceRepository extends JpaRepository<Invoice, Long> {
  Optional<Invoice> findByNumberIgnoreCase(String number);

  List<Invoice> findByBookingIdOrderByIdDesc(Long bookingId);

  List<Invoice> findAllByOrderByIdDesc();

  long countByNumberStartingWith(String prefix);
}
