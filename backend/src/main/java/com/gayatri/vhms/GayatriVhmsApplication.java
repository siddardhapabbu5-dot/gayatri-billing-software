package com.gayatri.vhms;

import java.net.URI;
import java.util.HashMap;
import java.util.Map;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class GayatriVhmsApplication {
  public static void main(String[] args) {
    SpringApplication app = new SpringApplication(GayatriVhmsApplication.class);
    Map<String, Object> fromRailway = railwayDatasourceOverrides();
    if (!fromRailway.isEmpty()) {
      app.setDefaultProperties(fromRailway);
    }
    app.run(args);
  }

  /**
   * Railway Postgres exposes {@code DATABASE_URL} like
   * {@code postgresql://user:pass@host:port/db}. Spring needs JDBC form.
   * Also honours explicit {@code SPRING_DATASOURCE_*} if already set.
   */
  static Map<String, Object> railwayDatasourceOverrides() {
    Map<String, Object> props = new HashMap<>();
    if (notBlank(System.getenv("SPRING_DATASOURCE_URL"))) {
      return props;
    }
    String raw = firstNonBlank(System.getenv("DATABASE_URL"), System.getenv("POSTGRES_URL"));
    if (raw == null || raw.isBlank()) {
      return props;
    }
    try {
      String normalized = raw.replace("postgres://", "postgresql://");
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
      props.put("spring.datasource.url", jdbc);
      if (notBlank(user) && !notBlank(System.getenv("SPRING_DATASOURCE_USERNAME"))) {
        props.put("spring.datasource.username", user);
      }
      if (pass != null && !notBlank(System.getenv("SPRING_DATASOURCE_PASSWORD"))) {
        props.put("spring.datasource.password", pass);
      }
      System.out.println("Gayatri: using Railway DATABASE_URL → " + host + ":" + port + "/" + db);
    } catch (Exception ex) {
      System.err.println("Gayatri: could not parse DATABASE_URL: " + ex.getMessage());
    }
    return props;
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
