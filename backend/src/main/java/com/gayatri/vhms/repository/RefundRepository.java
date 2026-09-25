package com.gayatri.vhms.repository;

import com.gayatri.vhms.entity.Refund;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RefundRepository extends JpaRepository<Refund, Long> {
  List<Refund> findByBookingIdOrderByIdDesc(Long bookingId);

  List<Refund> findAllByOrderByIdDesc();
}
