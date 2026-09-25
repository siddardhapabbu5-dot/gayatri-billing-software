package com.gayatri.vhms.web;

import com.gayatri.vhms.dto.ApiDtos.DocumentResponse;
import com.gayatri.vhms.entity.DocumentEntity;
import com.gayatri.vhms.security.StaffUserDetails;
import com.gayatri.vhms.service.DocumentService;
import java.util.List;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/documents")
@PreAuthorize("hasAuthority('PERM_ALL') or hasAuthority('PERM_DOCUMENTS')")
public class DocumentController {
  private final DocumentService documents;

  public DocumentController(DocumentService documents) {
    this.documents = documents;
  }

  @GetMapping
  public List<DocumentResponse> list(
      @RequestParam(required = false) Long bookingId,
      @RequestParam(required = false) Long guestId
  ) {
    return documents.list(bookingId, guestId);
  }

  @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  @ResponseStatus(HttpStatus.CREATED)
  public DocumentResponse upload(
      @RequestParam("file") MultipartFile file,
      @RequestParam(required = false) Long bookingId,
      @RequestParam(required = false) Long guestId,
      @RequestParam(required = false) String typeCode,
      @AuthenticationPrincipal StaffUserDetails actor
  ) {
    return documents.upload(file, bookingId, guestId, typeCode, actor);
  }

  @GetMapping("/{id}/file")
  public ResponseEntity<Resource> file(@PathVariable Long id) {
    DocumentEntity doc = documents.require(id);
    Resource body = documents.stream(doc);
    MediaType type = doc.getContentType() == null
        ? MediaType.APPLICATION_OCTET_STREAM
        : MediaType.parseMediaType(doc.getContentType());
    return ResponseEntity.ok()
        .contentType(type)
        .header(
            HttpHeaders.CONTENT_DISPOSITION,
            ContentDisposition.inline().filename(doc.getFileName()).build().toString()
        )
        .body(body);
  }
}
