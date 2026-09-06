package com.gayatri.vhms.repository;

import com.gayatri.vhms.entity.Guest;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface GuestRepository extends JpaRepository<Guest, Long> {
  @Query("""
      select g from Guest g
      where lower(g.name) like lower(concat('%', :q, '%'))
         or g.phone like concat('%', :q, '%')
         or lower(coalesce(g.email, '')) like lower(concat('%', :q, '%'))
      order by g.name
      """)
  List<Guest> search(@Param("q") String q);
}
