package com.gayatri.vhms.config;

import com.gayatri.vhms.domain.StaffRole;
import com.gayatri.vhms.entity.AppUser;
import com.gayatri.vhms.repository.AppUserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * Demo staff accounts with well-known passwords. Disabled unless
 * {@code app.seed.demo-users=true} so a production database never gains default logins.
 * Existing accounts are never touched: no password resets, no role changes.
 */
@Configuration
public class DataSeeder {
  private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);

  private final boolean seedDemoUsers;

  public DataSeeder(@Value("${app.seed.demo-users:false}") boolean seedDemoUsers) {
    this.seedDemoUsers = seedDemoUsers;
  }

  @Bean
  CommandLineRunner seedUsers(AppUserRepository users, PasswordEncoder encoder) {
    return args -> run(users, encoder);
  }

  void run(AppUserRepository users, PasswordEncoder encoder) {
    if (!seedDemoUsers) {
      log.info(
          "Demo user seeding SKIPPED (app.seed.demo-users=false). "
              + "Existing accounts and passwords are untouched. "
              + "Set APP_SEED_DEMO_USERS=true only for a throwaway dev database."
      );
      return;
    }
    log.warn("app.seed.demo-users=true — creating demo staff accounts with default passwords");
    seed(users, encoder, "owner@gayatrifunctionhall.com", "Owner", StaffRole.ADMIN, "Owner@123");
    seed(users, encoder, "desk@gayatrifunctionhall.com", "Duty manager", StaffRole.MANAGER, "Manager@123");
    seed(users, encoder, "front@gayatrifunctionhall.com", "Front desk", StaffRole.FRONTDESK, "Front@123");
    seed(users, encoder, "hk@gayatrifunctionhall.com", "Housekeeping", StaffRole.HOUSEKEEPING, "Hk@123");
    seed(users, encoder, "accounts@gayatrifunctionhall.com", "Accounts", StaffRole.ACCOUNTS, "Accounts@123");
    log.info("Demo staff seed users ready (see backend/README.md for passwords)");
  }

  private static void seed(
      AppUserRepository users,
      PasswordEncoder encoder,
      String email,
      String name,
      StaffRole role,
      String rawPassword
  ) {
    if (users.existsByEmailIgnoreCase(email)) {
      log.info("Demo seed: {} already exists, leaving it as-is", email);
      return;
    }
    AppUser u = new AppUser();
    u.setEmail(email);
    u.setFullName(name);
    u.setRole(role);
    u.setPasswordHash(encoder.encode(rawPassword));
    u.setActive(true);
    users.save(u);
  }
}
