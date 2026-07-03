package com.example.fileHandling.service;

import com.jcraft.jsch.*;
import org.springframework.stereotype.Service;
import java.io.FileInputStream;

@Service
public class OmvSftpService {

    private final String OMV_HOST = "192.168.50.10";
    private final int OMV_PORT = 22;
    private final String OMV_USER = "admin";        // your OMV username (seen in top right)
    private final String OMV_PASSWORD = "saisakthi2008";
    private final String OMV_UPLOAD_DIR = "/srv/dev-disk-by-uuid-2f4044e5-cd7b-4e2e-9d3e-7dacf9ad43e1/FileUpload/";

    public void uploadToOmv(String localFilePath, String filename) throws Exception {
        JSch jsch = new JSch();
        Session session = null;
        ChannelSftp channelSftp = null;

        try {
            session = jsch.getSession(OMV_USER, OMV_HOST, OMV_PORT);
            session.setPassword(OMV_PASSWORD);

            // Disable strict host key checking (fine for local network)
            session.setConfig("StrictHostKeyChecking", "no");
            session.connect();

            channelSftp = (ChannelSftp) session.openChannel("sftp");
            channelSftp.connect();

            // Navigate to upload directory on OMV
            channelSftp.cd(OMV_UPLOAD_DIR);

            // Upload the file
            try (FileInputStream fis = new FileInputStream(localFilePath)) {
                channelSftp.put(fis, filename);
            }

            System.out.println("File uploaded to OMV successfully: " + filename);

        } finally {
            if (channelSftp != null) channelSftp.disconnect();
            if (session != null) session.disconnect();
        }
    }
}