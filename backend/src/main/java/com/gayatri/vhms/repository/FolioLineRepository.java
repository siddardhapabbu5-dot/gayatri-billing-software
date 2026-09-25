package com.gayatri.vhms.repository;

import com.gayatri.vhms.entity.FolioLine;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FolioLineRepository extends JpaRepository<FolioLine, Long> {
  List<FolioLine> findByFolioIdOrderByIdAsc(Long folioId);
}
