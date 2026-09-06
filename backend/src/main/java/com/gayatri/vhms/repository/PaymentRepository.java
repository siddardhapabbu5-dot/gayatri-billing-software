package com.gayatri.vhms.repository;

import com.gayatri.vhms.entity.Payment;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PaymentRepository extends JpaRepository<Payment, Long> {
  List<Payment> findByBookingIdOrderByPaidAtAsc(Long bookingId);
}
