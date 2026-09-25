package com.gayatri.vhms.repository;

import com.gayatri.vhms.entity.DocumentEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DocumentRepository extends JpaRepository<DocumentEntity, Long> {
  List<DocumentEntity> findByBookingIdOrderByIdDesc(Long bookingId);

  List<DocumentEntity> findByGuestIdOrderByIdDesc(Long guestId);

  List<DocumentEntity> findAllByOrderByIdDesc();
}
