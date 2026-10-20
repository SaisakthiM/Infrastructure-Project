package com.example.fileHandling.controller;

import com.example.fileHandling.service.BankIdentityService;
import com.example.fileHandling.service.EngagementService;
import com.example.fileHandling.service.EngagementService.MediaStats;
import com.example.fileHandling.util.UploadsDir;
import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Stream;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

/** The Media District API: library listing, range-capable streaming, views, likes, creator earnings. */
@RestController
@CrossOrigin(origins = "*", maxAge = 3600)
public class MediaController {

  private final EngagementService engagement;
  private final BankIdentityService identity;

  public MediaController(EngagementService engagement, BankIdentityService identity) {
    this.engagement = engagement;
    this.identity = identity;
  }

  private static String ext(String name) {
    int dot = name.lastIndexOf('.');
    return dot < 0 ? "" : name.substring(dot + 1).toLowerCase(Locale.ROOT);
  }

  static String kindOf(String name) {
    switch (ext(name)) {
      case "mp4": case "webm": case "mov": case "m4v": case "mkv": case "ogv":
        return "video";
      case "png": case "jpg": case "jpeg": case "gif": case "webp": case "svg": case "avif":
        return "image";
      case "mp3": case "wav": case "ogg": case "flac": case "m4a": case "aac":
        return "audio";
      case "pdf": case "txt": case "md": case "doc": case "docx": case "csv":
        return "doc";
      default:
        return "other";
    }
  }

  static String mimeOf(Path file) {
    switch (ext(file.getFileName().toString())) {
      case "mp4": case "m4v": return "video/mp4";
      case "webm": return "video/webm";
      case "mov": return "video/quicktime";
      case "mkv": return "video/x-matroska";
      case "ogv": return "video/ogg";
      case "png": return "image/png";
      case "jpg": case "jpeg": return "image/jpeg";
      case "gif": return "image/gif";
      case "webp": return "image/webp";
      case "svg": return "image/svg+xml";
      case "mp3": return "audio/mpeg";
      case "wav": return "audio/wav";
      case "ogg": return "audio/ogg";
      case "pdf": return "application/pdf";
      case "txt": case "md": case "csv": return "text/plain";
      default:
        try {
          String probed = Files.probeContentType(file);
          return probed != null ? probed : "application/octet-stream";
        } catch (IOException e) {
          return "application/octet-stream";
        }
    }
  }

  /** The file inside the uploads folder, or null if the name is unsafe or the file is missing. */
  private Path resolve(String name) {
    if (name == null || name.isEmpty() || name.contains("..") || name.contains("/") || name.contains("\\")
        || name.startsWith(".")) {
      return null;
    }
    Path dir = UploadsDir.resolve().normalize();
    Path file = dir.resolve(name).normalize();
    if (!file.startsWith(dir) || !Files.isRegularFile(file)) return null;
    return file;
  }

  private static long modified(Path p) {
    try {
      return Files.getLastModifiedTime(p).toMillis();
    } catch (IOException e) {
      return 0L;
    }
  }

  private static long size(Path p) {
    try {
      return Files.size(p);
    } catch (IOException e) {
      return 0L;
    }
  }

  private static String clientKey(HttpServletRequest request) {
    String cf = request.getHeader("CF-Connecting-IP");
    if (cf != null && !cf.isBlank()) return cf.trim();
    String xff = request.getHeader("X-Forwarded-For");
    if (xff != null && !xff.isBlank()) return xff.split(",")[0].trim();
    return request.getRemoteAddr();
  }

  @GetMapping("/media")
  public Map<String, Object> list(
      @RequestHeader(value = "Authorization", required = false) String authorization,
      @RequestHeader(value = "X-City-Account", required = false) String accountId)
      throws IOException {
    String me = identity.verify(authorization, accountId);
    Path dir = UploadsDir.resolve();
    List<Map<String, Object>> files = new ArrayList<>();
    if (Files.isDirectory(dir)) {
      try (Stream<Path> stream = Files.list(dir)) {
        List<Path> sorted = stream
            .filter(Files::isRegularFile)
            .filter(p -> !p.getFileName().toString().startsWith("."))
            .sorted(Comparator.comparingLong(MediaController::modified).reversed())
            .toList();
        for (Path p : sorted) {
          String name = p.getFileName().toString();
          MediaStats s = engagement.stats(name);
          Map<String, Object> row = new LinkedHashMap<>();
          row.put("name", name);
          row.put("kind", kindOf(name));
          row.put("size", size(p));
          row.put("modified", modified(p));
          row.put("creator", s.creator);
          row.put("views", s.views);
          row.put("likes", s.likes());
          row.put("likedByMe", me != null && s.likedBy.contains(me));
          files.add(row);
        }
      }
    }
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("files", files);
    out.put("user", me);
    out.put("claimable", me == null ? 0L : engagement.claimable(me));
    out.put("viewsPerRupee", EngagementService.VIEWS_PER_RUPEE);
    out.put("rupeesPerLike", EngagementService.RUPEES_PER_LIKE);
    return out;
  }

  /** Inline streaming. Returning a Resource lets Spring answer Range requests with 206 so video can seek. */
  @GetMapping("/stream/{name:.+}")
  public ResponseEntity<Resource> stream(@PathVariable("name") String name) {
    Path file = resolve(name);
    if (file == null) return ResponseEntity.notFound().build();
    return ResponseEntity.ok()
        .contentType(MediaType.parseMediaType(mimeOf(file)))
        .header(HttpHeaders.CACHE_CONTROL, "private, max-age=300")
        .header(HttpHeaders.CONTENT_DISPOSITION, "inline")
        .body(new FileSystemResource(file));
  }

  @PostMapping("/media/{name:.+}/view")
  public ResponseEntity<Map<String, Object>> view(@PathVariable("name") String name, HttpServletRequest request) {
    if (resolve(name) == null) return ResponseEntity.notFound().build();
    MediaStats s = engagement.view(name, clientKey(request));
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("views", s.views);
    out.put("likes", s.likes());
    return ResponseEntity.ok(out);
  }

  @PostMapping("/media/{name:.+}/like")
  public ResponseEntity<Map<String, Object>> like(
      @PathVariable("name") String name,
      @RequestHeader(value = "Authorization", required = false) String authorization,
      @RequestHeader(value = "X-City-Account", required = false) String accountId) {
    String me = identity.verify(authorization, accountId);
    if (me == null) return error(HttpStatus.UNAUTHORIZED, "Log in to the city bank to like media.");
    if (resolve(name) == null) return ResponseEntity.notFound().build();
    boolean liked = engagement.toggleLike(name, me);
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("liked", liked);
    out.put("likes", engagement.stats(name).likes());
    return ResponseEntity.ok(out);
  }

  /** Pays out creator earnings. The browser then credits exactly this amount to the citizen's bank account. */
  @PostMapping("/media/claim")
  public ResponseEntity<Map<String, Object>> claim(
      @RequestHeader(value = "Authorization", required = false) String authorization,
      @RequestHeader(value = "X-City-Account", required = false) String accountId) {
    String me = identity.verify(authorization, accountId);
    if (me == null) return error(HttpStatus.UNAUTHORIZED, "Log in to the city bank to claim earnings.");
    long amount = engagement.claim(me);
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("amount", amount);
    return ResponseEntity.ok(out);
  }

  private static ResponseEntity<Map<String, Object>> error(HttpStatus status, String message) {
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("error", message);
    return ResponseEntity.status(status).body(body);
  }
}
