package com.gayatri.vhms.web;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.gayatri.vhms.dto.ApiDtos.EnquiryResponse;
import com.gayatri.vhms.dto.ApiDtos.PublicEnquiryRequest;
import com.gayatri.vhms.config.SecurityConfig;
import com.gayatri.vhms.security.JwtAuthFilter;
import com.gayatri.vhms.security.JwtService;
import com.gayatri.vhms.security.StaffUserDetailsService;
import com.gayatri.vhms.service.EnquiryService;
import java.time.Instant;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithAnonymousUser;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;

/**
 * Guards the two rules that matter most on the public surface: the website enquiry endpoint
 * must work without a token, and staff roles must not be able to reach user administration.
 */
@WebMvcTest(controllers = {PublicEnquiryController.class, EnquiryController.class})
@Import({SecurityConfig.class, JwtAuthFilter.class})
class PublicEnquirySecurityTest {

  @Autowired
  private MockMvc mvc;

  @MockBean
  private EnquiryService enquiries;

  @MockBean
  private JwtService jwtService;

  @MockBean
  private StaffUserDetailsService userDetailsService;

  private static final String BODY = """
      {
        "name": "Ramesh Kumar",
        "phone": "9876500011",
        "email": "ramesh@example.com",
        "date": "2026-12-11",
        "hall": "IMP",
        "guests": 700,
        "message": "Wedding reception enquiry",
        "agreeHall": true,
        "agreeRoom": false
      }
      """;

  @Test
  @WithAnonymousUser
  void websiteEnquiryIsAcceptedWithoutAToken() throws Exception {
    when(enquiries.submit(any(PublicEnquiryRequest.class))).thenReturn(sample());

    mvc.perform(post("/api/public/enquiries").contentType(MediaType.APPLICATION_JSON).content(BODY))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.bookingNumber").value("ENQ-2026-00001"));
  }

  @Test
  @WithAnonymousUser
  void doubleBookedDateIsReportedAsConflictNotAFakeSuccess() throws Exception {
    when(enquiries.submit(any(PublicEnquiryRequest.class)))
        .thenThrow(new ResponseStatusException(HttpStatus.CONFLICT, "Imperial Ballroom is already booked"));

    mvc.perform(post("/api/public/enquiries").contentType(MediaType.APPLICATION_JSON).content(BODY))
        .andExpect(status().isConflict());
  }

  @Test
  @WithAnonymousUser
  void enquiryRequiresAName() throws Exception {
    mvc.perform(post("/api/public/enquiries").contentType(MediaType.APPLICATION_JSON).content("{}"))
        .andExpect(status().isBadRequest());

    verify(enquiries, never()).submit(any(PublicEnquiryRequest.class));
  }

  @Test
  @WithAnonymousUser
  void staffEnquiryListStillRequiresAuthentication() throws Exception {
    // permitAll on /api/public/** must not leak into the staff namespace.
    mvc.perform(get("/api/enquiries")).andExpect(status().is4xxClientError());

    verify(enquiries, never()).list(any());
  }

  @Test
  @WithMockUser(roles = "FRONTDESK")
  void frontdeskCannotCreateStaffUsers() throws Exception {
    mvc.perform(post("/api/admin/users").contentType(MediaType.APPLICATION_JSON).content("{}"))
        .andExpect(status().isForbidden());
  }

  @Test
  @WithMockUser(roles = "HOUSEKEEPING")
  void housekeepingCannotCreateStaffUsers() throws Exception {
    mvc.perform(post("/api/admin/users").contentType(MediaType.APPLICATION_JSON).content("{}"))
        .andExpect(status().isForbidden());
  }

  private static EnquiryResponse sample() {
    return new EnquiryResponse(
        1L, "Ramesh Kumar", "9876500011", "ramesh@example.com", LocalDate.of(2026, 12, 11),
        "IMP", 700, "Wedding reception enquiry", "Open", 10L, "ENQ-2026-00001", true, false,
        Instant.parse("2026-09-25T06:30:00Z")
    );
  }
}
