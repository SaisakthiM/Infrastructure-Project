package com.example.fileHandling.controller;

import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.fileHandling.service.BankIdentityService;
import com.example.fileHandling.service.EngagementService;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(MediaController.class)
class MediaControllerTest {

  @Autowired private MockMvc mockMvc;
  @MockBean private EngagementService engagement;
  @MockBean private BankIdentityService identity;

  @TempDir Path tempDir;

  @BeforeEach
  void setUp() throws Exception {
    System.setProperty("user.dir", tempDir.toString());
    Files.createDirectories(tempDir.resolve("Uploads"));
    when(engagement.stats(anyString())).thenAnswer(inv -> new EngagementService.MediaStats());
  }

  private void put(String name, String content) throws Exception {
    Files.writeString(tempDir.resolve("Uploads").resolve(name), content);
  }

  @Test
  void listsFilesWithKindsAndHidesDotfiles() throws Exception {
    put("clip.mp4", "binary-content");
    put("photo.png", "png");
    put(".hidden", "x");

    mockMvc.perform(get("/media"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.files[*].name", containsInAnyOrder("clip.mp4", "photo.png")))
        .andExpect(jsonPath("$.claimable").value(0))
        .andExpect(jsonPath("$.viewsPerRupee").value(5));
  }

  @Test
  void listShowsClaimableForAVerifiedCreator() throws Exception {
    when(identity.verify("Bearer t", "7")).thenReturn("alice");
    when(engagement.claimable("alice")).thenReturn(12L);

    mockMvc.perform(get("/media").header("Authorization", "Bearer t").header("X-City-Account", "7"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.user").value("alice"))
        .andExpect(jsonPath("$.claimable").value(12));
  }

  @Test
  void streamsTheWholeFile() throws Exception {
    put("clip.mp4", "binary-content");
    mockMvc.perform(get("/stream/clip.mp4"))
        .andExpect(status().isOk())
        .andExpect(content().string("binary-content"));
  }

  @Test
  void streamHonoursRangeRequestsSoVideoCanSeek() throws Exception {
    put("clip.mp4", "binary-content");
    mockMvc.perform(get("/stream/clip.mp4").header("Range", "bytes=0-3"))
        .andExpect(status().isPartialContent())
        .andExpect(content().string("bina"));
  }

  @Test
  void streamOfMissingOrUnsafeNamesFails() throws Exception {
    mockMvc.perform(get("/stream/missing.mp4")).andExpect(status().isNotFound());
    mockMvc.perform(get("/stream/..%2Fsecret.txt")).andExpect(status().is4xxClientError());
  }

  @Test
  void viewIsCountedForExistingFiles() throws Exception {
    put("clip.mp4", "x");
    EngagementService.MediaStats stats = new EngagementService.MediaStats();
    stats.views = 7;
    when(engagement.view(eq("clip.mp4"), anyString())).thenReturn(stats);

    mockMvc.perform(post("/media/clip.mp4/view"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.views").value(7));
    mockMvc.perform(post("/media/nope.mp4/view")).andExpect(status().isNotFound());
  }

  @Test
  void likeNeedsAVerifiedCitizen() throws Exception {
    put("clip.mp4", "x");
    when(identity.verify(any(), any())).thenReturn(null);
    mockMvc.perform(post("/media/clip.mp4/like")).andExpect(status().isUnauthorized());

    when(identity.verify("Bearer t", "7")).thenReturn("bob");
    when(engagement.toggleLike("clip.mp4", "bob")).thenReturn(true);
    mockMvc.perform(post("/media/clip.mp4/like").header("Authorization", "Bearer t").header("X-City-Account", "7"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.liked").value(true));
  }

  @Test
  void claimNeedsAVerifiedCitizenAndReturnsTheServerAmount() throws Exception {
    when(identity.verify(any(), any())).thenReturn(null);
    mockMvc.perform(post("/media/claim")).andExpect(status().isUnauthorized());

    when(identity.verify("Bearer t", "7")).thenReturn("alice");
    when(engagement.claim("alice")).thenReturn(42L);
    mockMvc.perform(post("/media/claim").header("Authorization", "Bearer t").header("X-City-Account", "7"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.amount").value(42));
  }
}
