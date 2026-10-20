package com.example.fileHandling.util;

import java.io.File;
import java.nio.file.Path;
import java.nio.file.Paths;

/** Where uploads live, and what an uploaded file may be called. */
public final class UploadsDir {

  private UploadsDir() {}

  public static Path resolve() {
    String env = System.getenv("UPLOADS_DIR");
    String dir = (env != null && !env.isEmpty()) ? env : System.getProperty("user.dir") + File.separator + "Uploads";
    return Paths.get(dir);
  }

  /**
   * Strips any directory part from a client-supplied name and rejects anything that could escape the
   * uploads folder. Returns null if nothing usable is left.
   */
  public static String safeName(String raw) {
    if (raw == null) return null;
    String name = raw.replace('\\', '/');
    name = name.substring(name.lastIndexOf('/') + 1).trim();
    StringBuilder clean = new StringBuilder();
    for (char c : name.toCharArray()) {
      if (c >= 32 && c != 127) clean.append(c);
    }
    name = clean.toString();
    if (name.isEmpty() || name.equals(".") || name.equals("..") || name.startsWith(".") || name.length() > 200) {
      return null;
    }
    return name;
  }
}
