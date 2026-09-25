package com.gayatri.vhms.service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

/**
 * Stores uploads on the configured volume under opaque UUID keys. The original file name is
 * kept in the {@code documents} table only, so a hostile name can never reach the filesystem.
 */
@Service
public class FileStorageService {
  private static final Logger log = LoggerFactory.getLogger(FileStorageService.class);

  static final long MAX_DOC_BYTES = 8L * 1024 * 1024;
  static final long MAX_VIDEO_BYTES = 100L * 1024 * 1024;

  private static final Set<String> DOC_TYPES = Set.of(
      "image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/gif", "application/pdf"
  );
  private static final Set<String> VIDEO_TYPES = Set.of(
      "video/mp4", "video/quicktime", "video/webm", "video/x-matroska"
  );

  private final Path root;

  public FileStorageService(@Value("${app.upload-dir:/data/uploads}") String uploadDir) {
    this.root = Path.of(uploadDir).toAbsolutePath().normalize();
  }

  public Path getRoot() {
    return root;
  }

  /** Validates MIME + size, writes the bytes, and returns the storage key. */
  public String store(MultipartFile file) {
    if (file == null || file.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "File is required");
    }
    String contentType = normalizeType(file.getContentType());
    boolean video = VIDEO_TYPES.contains(contentType);
    if (!video && !DOC_TYPES.contains(contentType)) {
      throw new ResponseStatusException(
          HttpStatus.UNSUPPORTED_MEDIA_TYPE,
          "Only JPG, PNG, WEBP, GIF, PDF or MP4/MOV/WEBM video files are accepted"
      );
    }
    long limit = video ? MAX_VIDEO_BYTES : MAX_DOC_BYTES;
    if (file.getSize() > limit) {
      throw new ResponseStatusException(
          HttpStatus.PAYLOAD_TOO_LARGE,
          (video ? "Videos" : "Images and PDFs") + " must be under " + (limit / (1024 * 1024)) + " MB"
      );
    }

    String key = UUID.randomUUID() + extensionOf(file.getOriginalFilename(), contentType);
    Path target = root.resolve(key).normalize();
    if (!target.startsWith(root)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid file name");
    }
    try {
      Files.createDirectories(root);
      try (InputStream in = file.getInputStream()) {
        Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
      }
    } catch (IOException ex) {
      log.error("Upload failed for key {}", key, ex);
      throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not store the file");
    }
    return key;
  }

  public Resource load(String storageKey) {
    Path path = resolve(storageKey);
    if (!Files.isReadable(path)) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "File is no longer on disk");
    }
    return new FileSystemResource(path);
  }

  Path resolve(String storageKey) {
    if (storageKey == null || storageKey.isBlank()) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "File not found");
    }
    Path path = root.resolve(storageKey).normalize();
    if (!path.startsWith(root)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid storage key");
    }
    return path;
  }

  static String normalizeType(String raw) {
    if (raw == null) {
      return "";
    }
    int semi = raw.indexOf(';');
    return (semi < 0 ? raw : raw.substring(0, semi)).trim().toLowerCase(Locale.ROOT);
  }

  private static String extensionOf(String originalName, String contentType) {
    if (originalName != null) {
      int dot = originalName.lastIndexOf('.');
      if (dot > -1 && dot < originalName.length() - 1) {
        String ext = originalName.substring(dot + 1).toLowerCase(Locale.ROOT);
        if (ext.matches("[a-z0-9]{1,8}")) {
          return "." + ext;
        }
      }
    }
    int slash = contentType.indexOf('/');
    return slash < 0 ? "" : "." + contentType.substring(slash + 1).replaceAll("[^a-z0-9]", "");
  }
}
