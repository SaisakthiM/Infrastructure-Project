package com.example.fileHandling.controller;

import com.example.fileHandling.service.OmvSftpService;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(FileController.class)
class FileControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private OmvSftpService omvSftpService;

    @TempDir
    Path tempDir;

    /** Point the controller at our temp directory for every test. */
    @BeforeEach
    void setUp() {
        System.setProperty("user.dir", tempDir.toString());
    }

    // ── Helper ─────────────────────────────────────────────────────────────

    /** Creates a real file inside the controller's Uploads directory. */
    private File createUploadedFile(String name, String content) throws Exception {
        Path uploadsDir = tempDir.resolve("Uploads");
        Files.createDirectories(uploadsDir);
        Path file = uploadsDir.resolve(name);
        Files.writeString(file, content);
        return file.toFile();
    }

    // ══════════════════════════════════════════════════════════════════════
    // POST /upload
    // ══════════════════════════════════════════════════════════════════════

    @Test
    void uploadFile_success() throws Exception {
        MockMultipartFile mpf = new MockMultipartFile(
                "fileToUpload", "hello.txt", "text/plain", "hello world".getBytes());

        mockMvc.perform(multipart("/upload").file(mpf))
               .andExpect(status().isOk())
               .andExpect(content().string("File Uploaded Successfully!"));
    }

    @Test
    void uploadFile_createsFileOnDisk() throws Exception {
        MockMultipartFile mpf = new MockMultipartFile(
                "fileToUpload", "disk.txt", "text/plain", "data".getBytes());

        mockMvc.perform(multipart("/upload").file(mpf));

        File saved = tempDir.resolve("Uploads").resolve("disk.txt").toFile();
        Assertions.assertTrue(saved.exists());
    }

    @Test
    void uploadFile_triggersOmvBackupInBackground() throws Exception {
        MockMultipartFile mpf = new MockMultipartFile(
                "fileToUpload", "backup.txt", "text/plain", "data".getBytes());

        mockMvc.perform(multipart("/upload").file(mpf));

        // Background thread; give it a moment
        Thread.sleep(200);
        verify(omvSftpService, atLeastOnce()).uploadToOmv(anyString(), eq("backup.txt"));
    }

    // ══════════════════════════════════════════════════════════════════════
    // GET /getFiles
    // ══════════════════════════════════════════════════════════════════════

    @Test
    void getFiles_returnsEmptyArrayWhenNoneExist() throws Exception {
        mockMvc.perform(get("/getFiles"))
               .andExpect(status().isOk())
               .andExpect(content().json("[]"));
    }

    @Test
    void getFiles_returnsFilenames() throws Exception {
        createUploadedFile("a.mp4", "x");
        createUploadedFile("b.mp4", "y");

        mockMvc.perform(get("/getFiles"))
               .andExpect(status().isOk())
               .andExpect(jsonPath("$[?(@ == 'a.mp4')]").exists())
               .andExpect(jsonPath("$[?(@ == 'b.mp4')]").exists());
    }

    // ══════════════════════════════════════════════════════════════════════
    // GET /download/{filename}
    // ══════════════════════════════════════════════════════════════════════

    @Test
    void downloadFile_success() throws Exception {
        createUploadedFile("video.mp4", "binary-content");

        mockMvc.perform(get("/download/video.mp4"))
               .andExpect(status().isOk())
               .andExpect(header().string(
                       "Content-Disposition", "attachment; filename=\"video.mp4\""))
               .andExpect(content().string("binary-content"));
    }

    @Test
    void downloadFile_notFound() throws Exception {
        mockMvc.perform(get("/download/missing.mp4"))
               .andExpect(status().isNotFound())
               .andExpect(content().string("File Not Found"));
    }

    // ══════════════════════════════════════════════════════════════════════
    // DELETE /remove/{filename}
    // ══════════════════════════════════════════════════════════════════════

    @Test
    void removeFile_success() throws Exception {
        createUploadedFile("delete-me.mp4", "content");

        mockMvc.perform(delete("/remove/delete-me.mp4"))
               .andExpect(status().isOk())
               .andExpect(content().string("File Removed Successfully!"));
    }

    @Test
    void removeFile_deletesFileFromDisk() throws Exception {
        File f = createUploadedFile("gone.txt", "bye");

        mockMvc.perform(delete("/remove/gone.txt"));

        Assertions.assertFalse(f.exists());
    }

    @Test
    void removeFile_notFound() throws Exception {
        mockMvc.perform(delete("/remove/nonexistent.mp4"))
               .andExpect(status().isNotFound())
               .andExpect(content().string("File Not Found"));
    }


    @Test
    void removeFile_leftoverFilesUnaffected() throws Exception {
        createUploadedFile("keep.mp4", "keep");
        createUploadedFile("remove.mp4", "bye");

        mockMvc.perform(delete("/remove/remove.mp4"))
               .andExpect(status().isOk());

        File kept = tempDir.resolve("Uploads").resolve("keep.mp4").toFile();
        Assertions.assertTrue(kept.exists());
    }
}