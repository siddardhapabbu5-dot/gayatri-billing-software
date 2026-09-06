package com.gayatri.vhms.repository;

import com.gayatri.vhms.entity.Room;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface RoomRepository extends JpaRepository<Room, Long> {
  @Query("select r from Room r left join fetch r.type where r.active = true order by r.number")
  List<Room> findActiveWithType();
}
