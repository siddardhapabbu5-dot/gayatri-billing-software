package com.gayatri.vhms.security;

import com.gayatri.vhms.repository.AppUserRepository;
import com.gayatri.vhms.service.PermissionService;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
public class StaffUserDetailsService implements UserDetailsService {
  private final AppUserRepository users;
  private final PermissionService permissions;

  public StaffUserDetailsService(AppUserRepository users, PermissionService permissions) {
    this.users = users;
    this.permissions = permissions;
  }

  @Override
  public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
    return users.findByEmailIgnoreCase(username)
        .map(u -> new StaffUserDetails(u, permissions.effectivePermissions(u.getRole())))
        .orElseThrow(() -> new UsernameNotFoundException("User not found: " + username));
  }
}
