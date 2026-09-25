package com.gayatri.vhms.web;

import com.gayatri.vhms.dto.ApiDtos.DeskSnapshot;
import com.gayatri.vhms.service.DeskSnapshotService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/desk")
public class DeskController {
  private final DeskSnapshotService snapshots;

  public DeskController(DeskSnapshotService snapshots) {
    this.snapshots = snapshots;
  }

  /**
   * Read-only aggregate for multi-device sync. Any signed-in staff member may read it; the
   * UI hides the pages their role cannot use, and every write stays permission-checked.
   */
  @GetMapping("/snapshot")
  @PreAuthorize("isAuthenticated()")
  public DeskSnapshot snapshot() {
    return snapshots.build();
  }
}
