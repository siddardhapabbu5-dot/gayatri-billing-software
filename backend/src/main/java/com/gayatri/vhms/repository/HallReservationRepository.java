package com.gayatri.vhms.repository;

import com.gayatri.vhms.entity.HallReservation;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface HallReservationRepository extends JpaRepository<HallReservation, Long> {

  List<HallReservation> findByBookingId(Long bookingId);

  @Query("""
      select r from HallReservation r
      where r.hall.id = :hallId
        and r.eventDate = :eventDate
        and upper(r.status) <> 'CANCELLED'
        and (:ignoreBookingId is null or r.bookingId <> :ignoreBookingId)
      """)
  List<HallReservation> findClashes(
      @Param("hallId") Long hallId,
      @Param("eventDate") LocalDate eventDate,
      @Param("ignoreBookingId") Long ignoreBookingId
  );

  @Query("""
      select r.bookingId as bookingId, r.hall.code as label
      from HallReservation r
      where r.bookingId in :bookingIds and upper(r.status) <> 'CANCELLED'
      order by r.hall.code
      """)
  List<BookingLabelRow> findHallCodes(@Param("bookingIds") Collection<Long> bookingIds);
}
