package com.example.fileHandling.controller;

import com.example.fileHandling.service.OmvSftpService;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.util.Arrays;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PathVariable;
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

  private String getUploadsPath() {
    String env = System.getenv("UPLOADS_DIR");
    return (env != null && !env.isEmpty()) ? env : System.getProperty("user.dir") + "/Uploads";
  }

  @RequestMapping(value = "/upload", method = RequestMethod.POST)
  public String uploadFile(@RequestParam("fileToUpload") MultipartFile file) {
    String filePath = getUploadsPath() + File.separator + file.getOriginalFilename();

    try {
      new File(getUploadsPath()).mkdirs();
      FileOutputStream fout = new FileOutputStream(filePath);
      fout.write(file.getBytes());
      fout.close();

      // Upload to OMV in background — don't block the response
      String finalFilePath = filePath;
      String originalFilename = file.getOriginalFilename();
      new Thread(() -> {
        try {
          omvSftpService.uploadToOmv(finalFilePath, originalFilename);
          System.out.println("OMV backup successful: " + originalFilename);
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
  public ResponseEntity<String> removeFile(@PathVariable("path") String filename) {
    // Prevent path traversal
    if (filename.contains("..") || filename.contains("/") || filename.contains("\\")) {
      return ResponseEntity.badRequest().body("Invalid filename.");
    }

    String[] filenames = this.getFiles();
    boolean contains = Arrays.asList(filenames).contains(filename);

    if (!contains) {
      return new ResponseEntity<>("File Not Found", HttpStatus.NOT_FOUND);
    }

    String filePath = getUploadsPath() + File.separator + filename;
    File file = new File(filePath);

    if (!file.delete()) {
      return ResponseEntity
          .status(HttpStatus.INTERNAL_SERVER_ERROR)
          .body("Could not delete file: " + filename);
    }

    // Best-effort OMV removal in background — don't block the response
    /*
    new Thread(() -> {
      try {
        omvSftpService.removeFromOmv(filename);
        System.out.println("OMV removal successful: " + filename);
      } catch (Exception e) {
        System.out.println("OMV removal failed (non-critical): " + e.getMessage());
      }
    }).start();
    
    */

    return ResponseEntity.ok("File Removed Successfully!");
  }
}