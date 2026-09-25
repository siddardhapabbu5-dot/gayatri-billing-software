package com.gayatri.vhms.repository;

import com.gayatri.vhms.entity.Expense;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ExpenseRepository extends JpaRepository<Expense, Long> {
  List<Expense> findAllByOrderBySpentOnDescIdDesc();

  List<Expense> findBySpentOnBetweenOrderBySpentOnDescIdDesc(LocalDate from, LocalDate to);
}
