package com.gayatri.vhms;

import java.net.URI;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class GayatriVhmsApplication {
  public static void main(String[] args) {
    applyRailwayDatabaseUrl();
    SpringApplication.run(GayatriVhmsApplication.class, args);
  }

  /**
   * Railway provides {@code DATABASE_URL=postgresql://user:pass@host:port/db}.
   * Spring Boot needs JDBC + higher precedence than application.yml defaults
   * (system properties beat packaged yaml).
   */
  static void applyRailwayDatabaseUrl() {
    if (notBlank(System.getenv("SPRING_DATASOURCE_URL"))
        || notBlank(System.getProperty("spring.datasource.url"))) {
      System.out.println("Gayatri: SPRING_DATASOURCE_URL already set");
      return;
    }
    String raw = firstNonBlank(System.getenv("DATABASE_URL"), System.getenv("POSTGRES_URL"));
    if (!notBlank(raw)) {
      System.out.println("Gayatri: no DATABASE_URL env — using application.yml defaults");
      return;
    }
    try {
      String normalized = raw.trim().replace("postgres://", "postgresql://");
      URI uri = URI.create(normalized);
      String userInfo = uri.getUserInfo();
      String user = null;
      String pass = null;
      if (userInfo != null && !userInfo.isBlank()) {
        int colon = userInfo.indexOf(':');
        if (colon >= 0) {
          user = userInfo.substring(0, colon);
          pass = userInfo.substring(colon + 1);
        } else {
          user = userInfo;
        }
      }
      String host = uri.getHost();
      int port = uri.getPort() > 0 ? uri.getPort() : 5432;
      String path = uri.getPath() == null ? "" : uri.getPath();
      String db = path.startsWith("/") ? path.substring(1) : path;
      if (db.contains("?")) {
        db = db.substring(0, db.indexOf('?'));
      }
      String jdbc = "jdbc:postgresql://" + host + ":" + port + "/" + db;
      System.setProperty("spring.datasource.url", jdbc);
      if (notBlank(user)) {
        System.setProperty("spring.datasource.username", user);
      }
      if (pass != null) {
        System.setProperty("spring.datasource.password", pass);
      }
      System.out.println("Gayatri: DATABASE_URL applied → " + host + ":" + port + "/" + db);
    } catch (Exception ex) {
      System.err.println("Gayatri: could not parse DATABASE_URL: " + ex.getMessage());
    }
  }

  private static boolean notBlank(String s) {
    return s != null && !s.isBlank();
  }

  private static String firstNonBlank(String a, String b) {
    if (notBlank(a)) return a;
    if (notBlank(b)) return b;
    return null;
  }
}
