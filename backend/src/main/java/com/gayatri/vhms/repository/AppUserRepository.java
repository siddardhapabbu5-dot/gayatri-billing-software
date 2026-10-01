package com.gayatri.vhms.repository;

import com.gayatri.vhms.domain.StaffRole;
import com.gayatri.vhms.entity.AppUser;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AppUserRepository extends JpaRepository<AppUser, Long> {
  Optional<AppUser> findByEmailIgnoreCase(String email);
  boolean existsByEmailIgnoreCase(String email);

  @Query("""
      select u from AppUser u
      where u.phone = :phone and u.active = true and u.removedAt is null
      """)
  Optional<AppUser> findActiveByPhone(@Param("phone") String phone);

  long countByRoleAndActiveTrueAndRemovedAtIsNull(StaffRole role);

  List<AppUser> findByRemovedAtIsNullOrderByFullNameAsc();

  List<AppUser> findByRemovedAtIsNotNullOrderByRemovedAtDesc();

  @Query("""
      select u from AppUser u
      where u.removedAt is not null
         or (u.active = false and lower(u.email) like '%@gayatrifunctionhall.com')
      order by coalesce(u.removedAt, u.updatedAt) desc
      """)
  List<AppUser> findArchivedAccounts();
}
