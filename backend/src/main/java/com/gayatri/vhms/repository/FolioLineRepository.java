package com.gayatri.vhms.repository;

import com.gayatri.vhms.entity.FolioLine;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface FolioLineRepository extends JpaRepository<FolioLine, Long> {
  List<FolioLine> findByFolioIdOrderByIdAsc(Long folioId);

  @Query("""
      select l.folioId as bookingId, coalesce(sum(l.amount), 0) as total
      from FolioLine l
      where l.folioId in :folioIds
      group by l.folioId
      """)
  List<BookingTotalRow> sumByFolioIds(@Param("folioIds") Collection<Long> folioIds);
}
