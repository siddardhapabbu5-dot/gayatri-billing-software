package com.gayatri.vhms.web;

import com.gayatri.vhms.dto.ApiDtos.EnquiryResponse;
import com.gayatri.vhms.service.EnquiryService;
import java.util.List;
import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/enquiries")
@PreAuthorize("hasAuthority('PERM_ALL') or hasAuthority('PERM_RESERVATIONS') or hasAuthority('PERM_GUESTS')")
public class EnquiryController {
  private final EnquiryService enquiries;

  public EnquiryController(EnquiryService enquiries) {
    this.enquiries = enquiries;
  }

  @GetMapping
  public List<EnquiryResponse> list(@RequestParam(required = false) String status) {
    return enquiries.list(status);
  }

  @PutMapping("/{id}/status")
  public EnquiryResponse status(@PathVariable Long id, @RequestBody Map<String, String> body) {
    return enquiries.updateStatus(id, body.get("status"));
  }
}
