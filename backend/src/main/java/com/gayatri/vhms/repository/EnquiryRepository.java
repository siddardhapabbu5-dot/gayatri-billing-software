package com.gayatri.vhms.repository;

import com.gayatri.vhms.entity.Enquiry;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EnquiryRepository extends JpaRepository<Enquiry, Long> {
  List<Enquiry> findAllByOrderByCreatedAtDesc();

  List<Enquiry> findByStatusIgnoreCaseOrderByCreatedAtDesc(String status);
}
