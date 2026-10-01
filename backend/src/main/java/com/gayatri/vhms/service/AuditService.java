package com.gayatri.vhms.service;

import com.gayatri.vhms.entity.AuditLog;
import com.gayatri.vhms.repository.AuditLogRepository;
import com.gayatri.vhms.security.StaffUserDetails;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuditService {
  private final AuditLogRepository audits;

  public AuditService(AuditLogRepository audits) {
    this.audits = audits;
  }

  @Transactional
  public void record(StaffUserDetails actor, String action, String entity, String detail) {
    record(actor == null ? null : actor.getUser().getId(), action, entity, detail, null);
  }

  @Transactional
  public void record(Long userId, String action, String entity, String detail, String ipAddress) {
    AuditLog row = new AuditLog();
    row.setUserId(userId);
    row.setAction(action);
    row.setEntity(entity);
    row.setDetail(detail);
    row.setIpAddress(ipAddress);
    audits.save(row);
  }

  @Transactional(readOnly = true)
  public java.util.List<AuditLog> recent() {
    return audits.findTop100ByOrderByCreatedAtDesc();
  }
}
