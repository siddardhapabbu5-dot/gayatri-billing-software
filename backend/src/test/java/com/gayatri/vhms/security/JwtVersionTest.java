package com.gayatri.vhms.security;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.gayatri.vhms.config.JwtProperties;
import com.gayatri.vhms.domain.StaffRole;
import com.gayatri.vhms.entity.AppUser;
import org.junit.jupiter.api.Test;

class JwtVersionTest {
  @Test
  void passwordResetInvalidatesTokensIssuedBeforeIt() {
    JwtProperties props = new JwtProperties();
    props.setSecret("GayatriConventionHallJwtSecretKeyChangeInProduction_2026_MustBeLongEnough256Bits!!");
    props.setExpirationMs(60_000);
    JwtService jwt = new JwtService(props);

    AppUser user = new AppUser();
    user.setId(1L);
    user.setEmail("owner@gayatri.local");
    user.setFullName("Owner");
    user.setRole(StaffRole.ADMIN);
    user.setActive(true);
    user.setTokenVersion(0);
    StaffUserDetails details = new StaffUserDetails(user);

    String before = jwt.generateToken(details);
    assertTrue(jwt.isValid(before, details));

    user.setTokenVersion(1);
    assertFalse(jwt.isValid(before, details));
    assertTrue(jwt.isValid(jwt.generateToken(details), details));
  }
}
