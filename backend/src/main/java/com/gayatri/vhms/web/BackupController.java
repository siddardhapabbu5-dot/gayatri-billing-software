package com.gayatri.vhms.web;

import com.gayatri.vhms.dto.ApiDtos.DeskSnapshot;
import com.gayatri.vhms.security.StaffUserDetails;
import com.gayatri.vhms.service.AuditService;
import com.gayatri.vhms.service.BackupService;
import com.gayatri.vhms.service.BackupService.RestoreResult;
import com.gayatri.vhms.service.DeskSnapshotService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/backup")
public class BackupController {
  private final DeskSnapshotService snapshots;
  private final BackupService backups;
  private final AuditService audit;

  public BackupController(DeskSnapshotService snapshots, BackupService backups, AuditService audit) {
    this.snapshots = snapshots;
    this.backups = backups;
    this.audit = audit;
  }

  @GetMapping
  public DeskSnapshot download(@AuthenticationPrincipal StaffUserDetails actor) {
    audit.record(actor, "backup.download", "desk", "snapshot");
    return snapshots.build(actor);
  }

  @PostMapping("/restore")
  public RestoreResult restore(
      @RequestBody DeskSnapshot snap,
      @AuthenticationPrincipal StaffUserDetails actor
  ) {
    return backups.restore(snap, actor);
  }
}
