package com.gayatri.vhms.security;

import com.gayatri.vhms.domain.StaffRole;
import com.gayatri.vhms.entity.AppUser;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Set;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

public class StaffUserDetails implements UserDetails {
  private final AppUser user;

  public StaffUserDetails(AppUser user) {
    this.user = user;
  }

  public AppUser getUser() {
    return user;
  }

  public StaffRole getRole() {
    return user.getRole();
  }

  @Override
  public Collection<? extends GrantedAuthority> getAuthorities() {
    Set<GrantedAuthority> out = new LinkedHashSet<>();
    out.add(new SimpleGrantedAuthority(user.getRole().springRole()));
    for (String perm : user.getRole().getPermissions()) {
      if ("*".equals(perm)) {
        out.add(new SimpleGrantedAuthority("PERM_ALL"));
      } else {
        out.add(new SimpleGrantedAuthority("PERM_" + perm.replace('.', '_').toUpperCase()));
      }
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
  public boolean isAccountNonLocked() { return user.isActive(); }

  @Override
  public boolean isCredentialsNonExpired() { return true; }

  @Override
  public boolean isEnabled() { return user.isActive(); }
}
