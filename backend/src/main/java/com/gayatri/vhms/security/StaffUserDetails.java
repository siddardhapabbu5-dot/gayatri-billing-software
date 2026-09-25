package com.gayatri.vhms.security;

import com.gayatri.vhms.domain.PermissionKeys;
import com.gayatri.vhms.domain.StaffRole;
import com.gayatri.vhms.entity.AppUser;
import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.Set;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

public class StaffUserDetails implements UserDetails {
  private final AppUser user;
  private final Set<String> permissionKeys;

  public StaffUserDetails(AppUser user) {
    this(user, user.getRole().getDefaultPermissions());
  }

  public StaffUserDetails(AppUser user, Set<String> permissionKeys) {
    this.user = user;
    this.permissionKeys = Collections.unmodifiableSet(new LinkedHashSet<>(permissionKeys));
  }

  public AppUser getUser() {
    return user;
  }

  public StaffRole getRole() {
    return user.getRole();
  }

  public Set<String> getPermissionKeys() {
    return permissionKeys;
  }

  @Override
  public Collection<? extends GrantedAuthority> getAuthorities() {
    Set<GrantedAuthority> out = new LinkedHashSet<>();
    out.add(new SimpleGrantedAuthority(user.getRole().springRole()));
    for (String perm : permissionKeys) {
      out.add(new SimpleGrantedAuthority(PermissionKeys.toAuthority(perm)));
    }
    return out;
  }

  @Override
  public String getPassword() {
    return user.getPasswordHash();
  }

  @Override
  public String getUsername() {
    return user.getEmail();
  }

  @Override
  public boolean isAccountNonExpired() { return true; }

  @Override
  public boolean isAccountNonLocked() {
    return user.isActive() && !user.isRemoved();
  }

  @Override
  public boolean isCredentialsNonExpired() { return true; }

  @Override
  public boolean isEnabled() {
    return user.isActive() && !user.isRemoved();
  }
}
