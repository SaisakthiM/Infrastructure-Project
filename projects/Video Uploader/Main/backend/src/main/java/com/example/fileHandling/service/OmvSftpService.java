package com.example.fileHandling.service;

import com.jcraft.jsch.ChannelSftp;
import com.jcraft.jsch.JSch;
import com.jcraft.jsch.Session;
import java.io.FileInputStream;
import org.springframework.stereotype.Service;

/**
 * Optional off-box backup of uploads to the OpenMediaVault NAS over SFTP.
 * Configure with environment variables; with none set, backup is simply skipped:
 *   OMV_HOST, OMV_PORT (default 22), OMV_USER, OMV_PASSWORD, OMV_UPLOAD_DIR
 */
@Service
public class OmvSftpService {

  private static String env(String key, String fallback) {
    String v = System.getenv(key);
    return (v == null || v.isBlank()) ? fallback : v;
  }

  public boolean isConfigured() {
    return env("OMV_HOST", null) != null && env("OMV_USER", null) != null && env("OMV_PASSWORD", null) != null
        && env("OMV_UPLOAD_DIR", null) != null;
  }

  public void uploadToOmv(String localFilePath, String filename) throws Exception {
    if (!isConfigured()) {
      System.out.println("OMV backup skipped (OMV_* environment variables not set)");
      return;
    }
    JSch jsch = new JSch();
    Session session = null;
    ChannelSftp channel = null;
    try {
      session = jsch.getSession(env("OMV_USER", null), env("OMV_HOST", null), Integer.parseInt(env("OMV_PORT", "22")));
      session.setPassword(env("OMV_PASSWORD", null));
      // the NAS is on the private LAN; set OMV_STRICT_HOSTKEY=yes once a known_hosts file is mounted
      session.setConfig("StrictHostKeyChecking", env("OMV_STRICT_HOSTKEY", "no"));
      session.connect(10_000);

      channel = (ChannelSftp) session.openChannel("sftp");
      channel.connect(10_000);
      channel.cd(env("OMV_UPLOAD_DIR", null));
      try (FileInputStream in = new FileInputStream(localFilePath)) {
        channel.put(in, filename);
      }
    } finally {
      if (channel != null) channel.disconnect();
      if (session != null) session.disconnect();
    }
  }
}
