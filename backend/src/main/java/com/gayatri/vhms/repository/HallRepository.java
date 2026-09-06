package com.gayatri.vhms.repository;

import com.gayatri.vhms.entity.Hall;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HallRepository extends JpaRepository<Hall, Long> {
  List<Hall> findByActiveTrueOrderByNameAsc();
}
