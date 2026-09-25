package com.gayatri.vhms.web;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * SPA fallback for clean staff URLs.
 *
 * Direct browser requests / refreshes such as {@code /staff/calendar} must return
 * {@code index.html} so the React app can resolve the route. Without this, Spring
 * returns 404 when the Docker/nginx layer proxies everything to port 8080.
 *
 * Real files under {@code classpath:/static/} (JS, CSS, images, {@code /staff} as a
 * static file if present) are still served by the default resource handler; this
 * controller only matches path segments that are not files.
 */
@Controller
public class SpaForwardController {

  @GetMapping({"/staff", "/staff/"})
  public String staffRoot() {
    return "forward:/index.html";
  }

  @GetMapping("/staff/**")
  public String staffNested() {
    return "forward:/index.html";
  }
}
