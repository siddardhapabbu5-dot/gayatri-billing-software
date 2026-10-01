package com.gayatri.vhms.repository;

import com.gayatri.vhms.entity.StaffNotification;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StaffNotificationRepository extends JpaRepository<StaffNotification, Long> {
  List<StaffNotification> findTop30ByOrderByCreatedAtDesc();
}
