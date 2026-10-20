package com.example.fileHandling.controller;

import com.example.fileHandling.service.BankIdentityService;
import com.example.fileHandling.service.EngagementService;
import com.example.fileHandling.service.OmvSftpService;
import com.example.fileHandling.util.UploadsDir;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@CrossOrigin(origins = "*", maxAge = 3600)
public class FileController {

  @Autowired
  private OmvSftpService omvSftpService;

  // optional collaborators: absent in controller-slice tests, present in the running app
  @Autowired(required = false)
  private EngagementService engagement;

  @Autowired(required = false)
  private BankIdentityService identity;

  private String getUploadsPath() {
    return UploadsDir.resolve().toString();
  }

  private String verifiedUser(String authorization, String accountId) {
    return identity == null ? null : identity.verify(authorization, accountId);
  }

  @RequestMapping(value = "/upload", method = RequestMethod.POST)
  public String uploadFile(
      @RequestParam("fileToUpload") MultipartFile file,
      @RequestHeader(value = "Authorization", required = false) String authorization,
      @RequestHeader(value = "X-City-Account", required = false) String accountId) {

    String name = UploadsDir.safeName(file.getOriginalFilename());
    if (name == null) {
      return "Error: invalid file name";
    }

    try {
      Path dir = UploadsDir.resolve();
      Files.createDirectories(dir);
      Path target = dir.resolve(name).normalize();
      if (!target.startsWith(dir.normalize())) {
        return "Error: invalid file name";
      }
      file.transferTo(target);

      if (engagement != null) {
        String creator = verifiedUser(authorization, accountId);
        engagement.registerUpload(name, creator == null ? "anonymous" : creator);
      }

      // Upload to OMV in background — don't block the response
      final String finalFilePath = target.toString();
      final String finalName = name;
      new Thread(() -> {
        try {
          omvSftpService.uploadToOmv(finalFilePath, finalName);
          System.out.println("OMV backup successful: " + finalName);
        } catch (Exception e) {
          System.out.println("OMV backup failed (non-critical): " + e.getMessage());
        }
      }).start();

      return "File Uploaded Successfully!";

    } catch (Exception e) {
      e.printStackTrace();
      return "Error: " + e.getMessage();
    }
  }

  @RequestMapping(value = "/getFiles", method = RequestMethod.GET)
  public String[] getFiles() {
    File directory = new File(getUploadsPath());
    if (!directory.exists()) directory.mkdirs();
    String[] filenames = directory.list();
    return filenames != null ? filenames : new String[]{};
  }

  @RequestMapping(value = "/download/{path:.+}", method = RequestMethod.GET)
  public ResponseEntity<InputStreamResource> downloadFile(@PathVariable("path") String filename)
      throws FileNotFoundException {
    String[] filenames = this.getFiles();
    boolean contains = Arrays.asList(filenames).contains(filename);

    if (!contains) {
      return new ResponseEntity("File Not Found", HttpStatus.NOT_FOUND);
    }

    String filePath = getUploadsPath() + File.separator + filename;
    File file = new File(filePath);

    InputStreamResource resource = new InputStreamResource(new FileInputStream(file));

    return ResponseEntity.ok()
        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
        .contentType(MediaType.APPLICATION_OCTET_STREAM)
        .contentLength(file.length())
        .body(resource);
  }

  @RequestMapping(value = "/remove/{path:.+}", method = RequestMethod.DELETE)
  public ResponseEntity<String> removeFile(
      @PathVariable("path") String filename,
      @RequestHeader(value = "Authorization", required = false) String authorization,
      @RequestHeader(value = "X-City-Account", required = false) String accountId) {
    // Prevent path traversal
    if (filename.contains("..") || filename.contains("/") || filename.contains("\\")) {
      return ResponseEntity.badRequest().body("Invalid filename.");
    }

    String[] filenames = this.getFiles();
    boolean contains = Arrays.asList(filenames).contains(filename);

    if (!contains) {
      return new ResponseEntity<>("File Not Found", HttpStatus.NOT_FOUND);
    }

    // uploads made by a logged-in citizen can only be removed by that citizen
    if (engagement != null && !engagement.canDelete(filename, verifiedUser(authorization, accountId))) {
      return ResponseEntity.status(HttpStatus.FORBIDDEN).body("You can only delete your own uploads.");
    }

    String filePath = getUploadsPath() + File.separator + filename;
    File file = new File(filePath);

    if (!file.delete()) {
      return ResponseEntity
          .status(HttpStatus.INTERNAL_SERVER_ERROR)
          .body("Could not delete file: " + filename);
    }

    if (engagement != null) {
      engagement.forget(filename);
    }

    return ResponseEntity.ok("File Removed Successfully!");
  }
}
