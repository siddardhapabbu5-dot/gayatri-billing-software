package com.gayatri.vhms.repository;

import com.gayatri.vhms.entity.Folio;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FolioRepository extends JpaRepository<Folio, Long> {
  Optional<Folio> findByBookingId(Long bookingId);

  List<Folio> findByBookingIdIn(Collection<Long> bookingIds);
}
