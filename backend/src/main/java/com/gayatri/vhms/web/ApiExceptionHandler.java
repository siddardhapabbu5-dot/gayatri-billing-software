package com.gayatri.vhms.web;

import com.gayatri.vhms.dto.AuthDtos.ApiError;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class ApiExceptionHandler {

  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<ApiError> validation(MethodArgumentNotValidException ex) {
    List<String> details = ex.getBindingResult().getFieldErrors().stream()
        .map(this::format)
        .collect(Collectors.toList());
    return ResponseEntity.badRequest().body(new ApiError("Validation failed", details));
  }

  @ExceptionHandler(BadCredentialsException.class)
  public ResponseEntity<ApiError> badCreds(BadCredentialsException ex) {
    return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
        .body(new ApiError("Invalid email or password", List.of()));
  }

  @ExceptionHandler(AccessDeniedException.class)
  public ResponseEntity<ApiError> denied(AccessDeniedException ex) {
    return ResponseEntity.status(HttpStatus.FORBIDDEN)
        .body(new ApiError("Access denied for your role", List.of()));
  }

  @ExceptionHandler(ResponseStatusException.class)
  public ResponseEntity<ApiError> status(ResponseStatusException ex) {
    return ResponseEntity.status(ex.getStatusCode())
        .body(new ApiError(ex.getReason() == null ? "Error" : ex.getReason(), List.of()));
  }

  @ExceptionHandler(IllegalArgumentException.class)
  public ResponseEntity<ApiError> illegal(IllegalArgumentException ex) {
    return ResponseEntity.badRequest().body(new ApiError(ex.getMessage(), List.of()));
  }

  private String format(FieldError e) {
    return e.getField() + ": " + e.getDefaultMessage();
  }
}
