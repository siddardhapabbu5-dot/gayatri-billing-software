package com.gayatri.vhms.repository;

import com.gayatri.vhms.entity.RoomReservation;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RoomReservationRepository extends JpaRepository<RoomReservation, Long> {

  List<RoomReservation> findByBookingId(Long bookingId);

  /** Half-open overlap: existing.checkIn &lt; requested.checkOut AND existing.checkOut &gt; requested.checkIn. */
  @Query("""
      select r from RoomReservation r
      where r.room.id = :roomId
        and upper(r.status) <> 'CANCELLED'
        and r.checkIn < :checkOut
        and r.checkOut > :checkIn
        and (:ignoreBookingId is null or r.bookingId <> :ignoreBookingId)
      """)
  List<RoomReservation> findClashes(
      @Param("roomId") Long roomId,
      @Param("checkIn") LocalDate checkIn,
      @Param("checkOut") LocalDate checkOut,
      @Param("ignoreBookingId") Long ignoreBookingId
  );

  @Query("""
      select r.bookingId as bookingId, r.room.number as label
      from RoomReservation r
      where r.bookingId in :bookingIds and upper(r.status) <> 'CANCELLED'
      order by r.room.number
      """)
  List<BookingLabelRow> findRoomNumbers(@Param("bookingIds") Collection<Long> bookingIds);
}
