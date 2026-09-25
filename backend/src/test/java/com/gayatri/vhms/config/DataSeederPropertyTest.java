package com.gayatri.vhms.config;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.gayatri.vhms.entity.AppUser;
import com.gayatri.vhms.repository.AppUserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class DataSeederPropertyTest {

  @Mock
  private AppUserRepository users;

  @Mock
  private PasswordEncoder encoder;

  @Test
  void demoUsersAreNotSeededByDefault() {
    new DataSeeder(false).run(users, encoder);

    verifyNoInteractions(users);
    verifyNoInteractions(encoder);
  }

  @Test
  void demoUsersAreSeededOnlyWhenExplicitlyEnabled() {
    when(users.existsByEmailIgnoreCase(anyString())).thenReturn(false);
    when(encoder.encode(anyString())).thenReturn("hashed");

    new DataSeeder(true).run(users, encoder);

    verify(users, times(5)).save(any(AppUser.class));
  }

  @Test
  void existingAccountsAreNeverRewritten() {
    when(users.existsByEmailIgnoreCase(anyString())).thenReturn(true);

    new DataSeeder(true).run(users, encoder);

    verify(users, never()).save(any(AppUser.class));
    verify(encoder, never()).encode(anyString());
  }
}
