package com.gayatri.vhms.service;

import com.gayatri.vhms.dto.ApiDtos.NotificationResponse;
import com.gayatri.vhms.entity.StaffNotification;
import com.gayatri.vhms.repository.StaffNotificationRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class StaffNoticeService {
  private final StaffNotificationRepository notices;

  public StaffNoticeService(StaffNotificationRepository notices) {
    this.notices = notices;
  }

  @Transactional
  public void post(String title, String body) {
    StaffNotification row = new StaffNotification();
    row.setTitle(clip(title, 160));
    row.setBody(clip(body, 500));
    notices.save(row);
  }

  @Transactional(readOnly = true)
  public List<NotificationResponse> recent() {
    return notices.findTop30ByOrderByCreatedAtDesc().stream()
        .map(row -> new NotificationResponse(row.getId(), row.getTitle(), row.getBody(), row.getCreatedAt()))
        .toList();
  }

  private static String clip(String value, int max) {
    String text = value == null ? "" : value.trim();
    if (text.isEmpty()) {
      return "Update";
    }
    return text.length() <= max ? text : text.substring(0, max);
  }
}
