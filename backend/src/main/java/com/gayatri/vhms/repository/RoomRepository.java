package com.gayatri.vhms.repository;

import com.gayatri.vhms.entity.Room;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RoomRepository extends JpaRepository<Room, Long> {
  @Query("select r from Room r left join fetch r.type where r.active = true order by r.number")
  List<Room> findActiveWithType();

  /** SELECT ... FOR UPDATE on the room row to serialise overlap checks. */
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select r from Room r where r.id = :id")
  Optional<Room> lockById(@Param("id") Long id);

  @Query("select r from Room r left join fetch r.type where r.id = :id")
  Optional<Room> findByIdWithType(@Param("id") Long id);
}
