package com.gayatri.vhms.repository;

import com.gayatri.vhms.entity.Hall;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface HallRepository extends JpaRepository<Hall, Long> {
  List<Hall> findByActiveTrueOrderByNameAsc();

  /**
   * SELECT ... FOR UPDATE on the hall row so two concurrent bookings for the same
   * hall + date cannot both pass the conflict check.
   */
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select h from Hall h where h.id = :id")
  Optional<Hall> lockById(@Param("id") Long id);

  @Query("""
      select h from Hall h
      where h.active = true
        and (lower(h.code) = lower(:key) or lower(h.name) = lower(:key))
      order by h.name
      """)
  List<Hall> findByCodeOrName(@Param("key") String key);

  @Query("""
      select h from Hall h
      where h.active = true and lower(h.name) like lower(concat('%', :key, '%'))
      order by h.name
      """)
  List<Hall> findByNameContains(@Param("key") String key);
}
