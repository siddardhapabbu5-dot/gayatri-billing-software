package com.gayatri.vhms.repository;

import com.gayatri.vhms.entity.PasswordResetChallenge;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PasswordResetRepository extends JpaRepository<PasswordResetChallenge, Long> {
  List<PasswordResetChallenge> findByUserIdAndConsumedFalse(Long userId);

  Optional<PasswordResetChallenge> findByResetHashAndConsumedFalse(String resetHash);
}
