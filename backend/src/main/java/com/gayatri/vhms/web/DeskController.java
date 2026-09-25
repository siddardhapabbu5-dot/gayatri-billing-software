package com.gayatri.vhms.web;

import com.gayatri.vhms.dto.ApiDtos.DeskSnapshot;
import com.gayatri.vhms.security.StaffUserDetails;
import com.gayatri.vhms.service.DeskSnapshotService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
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

  @GetMapping("/snapshot")
  @PreAuthorize("isAuthenticated()")
  public DeskSnapshot snapshot(@AuthenticationPrincipal StaffUserDetails actor) {
    return snapshots.build(actor);
  }
}
