package com.gayatri.vhms.repository;

import com.gayatri.vhms.entity.RolePermission;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RolePermissionRepository extends JpaRepository<RolePermission, RolePermission.Pk> {
  List<RolePermission> findByRole(String role);
  void deleteByRole(String role);
}
