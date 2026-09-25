package com.gayatri.vhms.web;

import com.gayatri.vhms.dto.ApiDtos.EnquiryResponse;
import com.gayatri.vhms.dto.ApiDtos.PublicEnquiryRequest;
import com.gayatri.vhms.service.EnquiryService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Website forms. Unauthenticated by design — see SecurityConfig permitAll for /api/public/**. */
@RestController
@RequestMapping("/api/public")
public class PublicEnquiryController {
  private final EnquiryService enquiries;

  public PublicEnquiryController(EnquiryService enquiries) {
    this.enquiries = enquiries;
  }

  @PostMapping("/enquiries")
  @ResponseStatus(HttpStatus.CREATED)
  public EnquiryResponse create(@Valid @RequestBody PublicEnquiryRequest req) {
    return enquiries.submit(req);
  }
}
