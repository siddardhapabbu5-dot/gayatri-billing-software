package com.gayatri.vhms.repository;

import com.gayatri.vhms.entity.AuditLog;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {
  List<AuditLog> findTop100ByOrderByCreatedAtDesc();
}
