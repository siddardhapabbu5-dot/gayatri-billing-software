package com.gayatri.vhms.repository;

import com.gayatri.vhms.entity.Payment;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PaymentRepository extends JpaRepository<Payment, Long> {
  List<Payment> findByBookingIdOrderByPaidAtAsc(Long bookingId);

  List<Payment> findAllByOrderByPaidAtAsc();

  @Query("""
      select p.bookingId as bookingId, sum(p.amount) as total
      from Payment p
      where p.bookingId in :bookingIds
      group by p.bookingId
      """)
  List<BookingTotalRow> sumByBookingIds(@Param("bookingIds") Collection<Long> bookingIds);
}
