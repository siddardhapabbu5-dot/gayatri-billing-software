package com.gayatri.vhms.security;

import com.gayatri.vhms.config.JwtProperties;
import com.gayatri.vhms.domain.StaffRole;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import javax.crypto.SecretKey;
import org.springframework.stereotype.Service;

@Service
public class JwtService {
  private final JwtProperties props;
  private final SecretKey key;

  public JwtService(JwtProperties props) {
    this.props = props;
    this.key = Keys.hmacShaKeyFor(props.getSecret().getBytes(StandardCharsets.UTF_8));
  }

  public String generateToken(StaffUserDetails user) {
    long now = System.currentTimeMillis();
    return Jwts.builder()
        .subject(user.getUsername())
        .claim("uid", user.getUser().getId())
        .claim("name", user.getUser().getFullName())
        .claim("role", user.getRole().name())
        .issuedAt(new Date(now))
        .expiration(new Date(now + props.getExpirationMs()))
        .signWith(key)
        .compact();
  }

  public String extractEmail(String token) {
    return parse(token).getSubject();
  }

  public StaffRole extractRole(String token) {
    return StaffRole.from(String.valueOf(parse(token).get("role")));
  }

  public boolean isValid(String token, StaffUserDetails user) {
    Claims claims = parse(token);
    return claims.getSubject().equalsIgnoreCase(user.getUsername())
        && claims.getExpiration().after(new Date());
  }

  private Claims parse(String token) {
    return Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
  }
}
