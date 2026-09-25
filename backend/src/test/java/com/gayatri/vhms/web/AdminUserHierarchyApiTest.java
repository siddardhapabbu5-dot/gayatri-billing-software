package com.gayatri.vhms.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.gayatri.vhms.config.JwtProperties;
import com.gayatri.vhms.config.SecurityConfig;
import com.gayatri.vhms.domain.StaffRole;
import com.gayatri.vhms.entity.AppUser;
import com.gayatri.vhms.repository.AppUserRepository;
import com.gayatri.vhms.security.JwtAuthFilter;
import com.gayatri.vhms.security.JwtService;
import com.gayatri.vhms.security.StaffUserDetails;
import com.gayatri.vhms.security.StaffUserDetailsService;
import com.gayatri.vhms.service.AuditService;
import com.gayatri.vhms.service.AuthService;
import com.gayatri.vhms.service.PermissionService;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Manager credentials against PUT/POST /api/admin/users — real AuthService hierarchy rules.
 */
@WebMvcTest(controllers = AdminUserController.class)
@Import({SecurityConfig.class, JwtAuthFilter.class, ApiExceptionHandler.class, AuthService.class})
class AdminUserHierarchyApiTest {

  @Autowired
  private MockMvc mvc;

  @MockBean
  private AppUserRepository users;

  @MockBean
  private PermissionService permissions;

  @MockBean
  private AuditService audit;

  @MockBean
  private PasswordEncoder encoder;

  @MockBean
  private AuthenticationManager authenticationManager;

  @MockBean
  private JwtService jwtService;

  @MockBean
  private JwtProperties jwtProperties;

  @MockBean
  private StaffUserDetailsService userDetailsService;

  private static UsernamePasswordAuthenticationToken asManager() {
    AppUser u = stored(2L, "manager@gayatri.local", StaffRole.MANAGER);
    StaffUserDetails details = new StaffUserDetails(u, StaffRole.MANAGER.getDefaultPermissions());
    return new UsernamePasswordAuthenticationToken(details, null, details.getAuthorities());
  }

  private static AppUser stored(Long id, String email, StaffRole role) {
    AppUser u = new AppUser();
    u.setId(id);
    u.setEmail(email);
    u.setFullName(role.name());
    u.setRole(role);
    u.setPasswordHash("hash");
    u.setActive(true);
    return u;
  }

  @Test
  void managerCannotResetOwnerPasswordOrDeactivateViaPut() throws Exception {
    when(users.findById(1L)).thenReturn(Optional.of(stored(1L, "owner@gayatri.local", StaffRole.ADMIN)));

    mvc.perform(put("/api/admin/users/1")
            .with(authentication(asManager()))
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"newPassword":"HackedPass9","active":false}
                """))
        .andExpect(status().isForbidden());

    verify(users, never()).save(any());
  }

  @Test
  void managerCannotChangeManagerRoleOrPassword() throws Exception {
    when(users.findById(3L)).thenReturn(Optional.of(stored(3L, "mgr2@gayatri.local", StaffRole.MANAGER)));

    mvc.perform(put("/api/admin/users/3")
            .with(authentication(asManager()))
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"newPassword":"HackedPass9","role":"FRONTDESK"}
                """))
        .andExpect(status().isForbidden());

    verify(users, never()).save(any());
  }

  @Test
  void managerCannotCreateAccountsHousekeepingOrOwner() throws Exception {
    for (String role : new String[] {"ACCOUNTS", "HOUSEKEEPING", "ADMIN", "MANAGER"}) {
      mvc.perform(post("/api/admin/users")
              .with(authentication(asManager()))
              .contentType(MediaType.APPLICATION_JSON)
              .content("""
                  {
                    "email":"blocked-%s@gayatri.local",
                    "password":"Password1!",
                    "fullName":"Blocked",
                    "role":"%s"
                  }
                  """.formatted(role.toLowerCase(), role)))
          .andExpect(status().isForbidden());
    }
    verify(users, never()).save(any());
  }

  @Test
  void managerCannotPromoteStaffToManager() throws Exception {
    when(users.findById(10L)).thenReturn(Optional.of(stored(10L, "staff@gayatri.local", StaffRole.FRONTDESK)));

    mvc.perform(put("/api/admin/users/10")
            .with(authentication(asManager()))
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"role":"MANAGER"}
                """))
        .andExpect(status().isForbidden());

    verify(users, never()).save(any());
  }

  @Test
  void managerCanCreateFrontDeskStaff() throws Exception {
    when(users.existsByEmailIgnoreCase("desk@gayatri.local")).thenReturn(false);
    when(encoder.encode(anyString())).thenReturn("encoded");
    when(permissions.effectivePermissions(StaffRole.FRONTDESK)).thenReturn(Set.of("billing"));
    when(users.save(any(AppUser.class))).thenAnswer(inv -> {
      AppUser u = inv.getArgument(0);
      u.setId(99L);
      return u;
    });

    mvc.perform(post("/api/admin/users")
            .with(authentication(asManager()))
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "email":"desk@gayatri.local",
                  "password":"Password1!",
                  "fullName":"Desk User",
                  "role":"FRONTDESK"
                }
                """))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.email").value("desk@gayatri.local"))
        .andExpect(jsonPath("$.role").value("FRONTDESK"));

    verify(users).save(any(AppUser.class));
  }

  @Test
  void managerCanDeactivateFrontDeskStaff() throws Exception {
    when(users.findById(10L)).thenReturn(Optional.of(stored(10L, "staff@gayatri.local", StaffRole.FRONTDESK)));
    when(permissions.effectivePermissions(StaffRole.FRONTDESK)).thenReturn(Set.of("billing"));
    when(users.save(any(AppUser.class))).thenAnswer(inv -> inv.getArgument(0));

    mvc.perform(put("/api/admin/users/10")
            .with(authentication(asManager()))
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"active":false}
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.active").value(false));
  }
}
