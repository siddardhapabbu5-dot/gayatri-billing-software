package com.gayatri.vhms.repository;

import com.gayatri.vhms.entity.Booking;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BookingRepository extends JpaRepository<Booking, Long> {
  Optional<Booking> findByNumberIgnoreCase(String number);

  @Query("""
      select b from Booking b join fetch b.guest g
      where lower(b.number) like lower(concat('%', :q, '%'))
         or lower(g.name) like lower(concat('%', :q, '%'))
         or g.phone like concat('%', :q, '%')
      order by b.eventDate desc, b.id desc
      """)
  List<Booking> search(@Param("q") String q);

  @Query("""
      select b from Booking b join fetch b.guest
      where b.status <> :status
      order by b.eventDate desc, b.id desc
      """)
  List<Booking> findByStatusNotOrderByEventDateDescIdDesc(@Param("status") String status);

  @Query("select b from Booking b join fetch b.guest where b.id = :id")
  Optional<Booking> findByIdWithGuest(@Param("id") Long id);

  long countByNumberStartingWith(String prefix);
}
