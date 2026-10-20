package com.example.fileHandling.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Path;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class EngagementServiceTest {

  @TempDir Path dir;
  private AtomicLong now;
  private EngagementService service;

  @BeforeEach
  void setUp() {
    now = new AtomicLong(1_000_000L);
    service = new EngagementService(dir.toString());
    service.setClock(now::get);
  }

  @Test
  void sameClientCountsOncePerThirtySeconds() {
    service.registerUpload("a.mp4", "alice");
    service.view("a.mp4", "client-1");
    service.view("a.mp4", "client-1");
    assertEquals(1, service.stats("a.mp4").views);

    now.addAndGet(31_000);
    service.view("a.mp4", "client-1");
    assertEquals(2, service.stats("a.mp4").views);
  }

  @Test
  void differentClientsAllCount() {
    service.registerUpload("a.mp4", "alice");
    for (int i = 0; i < 4; i++) service.view("a.mp4", "client-" + i);
    assertEquals(4, service.stats("a.mp4").views);
  }

  @Test
  void creatorEarnsOneRupeePerFiveViewsAndOnlyOnce() {
    service.registerUpload("a.mp4", "alice");
    for (int i = 0; i < 12; i++) service.view("a.mp4", "c" + i);

    assertEquals(2, service.claimable("alice"));
    assertEquals(2, service.claim("alice"));
    assertEquals(0, service.claim("alice"));

    for (int i = 12; i < 15; i++) service.view("a.mp4", "c" + i); // 15 views total, 10 already paid
    assertEquals(1, service.claim("alice"));
  }

  @Test
  void likesPayThreeRupeesEachAndUnlikeDoesNotRefundOrDoublePay() {
    service.registerUpload("a.mp4", "alice");
    assertTrue(service.toggleLike("a.mp4", "bob"));
    assertTrue(service.toggleLike("a.mp4", "carol"));
    assertEquals(6, service.claim("alice"));

    assertFalse(service.toggleLike("a.mp4", "bob")); // unlike
    assertTrue(service.toggleLike("a.mp4", "bob"));  // like again: not a new like for payout purposes
    assertEquals(0, service.claim("alice"));
  }

  @Test
  void onlyTheCreatorCanClaim() {
    service.registerUpload("a.mp4", "alice");
    for (int i = 0; i < 10; i++) service.view("a.mp4", "c" + i);
    assertEquals(0, service.claim("mallory"));
    assertEquals(2, service.claim("alice"));
  }

  @Test
  void deleteRules() {
    service.registerUpload("anon.mp4", null);
    service.registerUpload("owned.mp4", "alice");
    assertTrue(service.canDelete("anon.mp4", null));
    assertTrue(service.canDelete("unknown-file.mp4", null));
    assertFalse(service.canDelete("owned.mp4", null));
    assertFalse(service.canDelete("owned.mp4", "bob"));
    assertTrue(service.canDelete("owned.mp4", "alice"));
  }

  @Test
  void statsSurviveARestart() {
    service.registerUpload("a.mp4", "alice");
    service.view("a.mp4", "c1");
    service.toggleLike("a.mp4", "bob");

    EngagementService reloaded = new EngagementService(dir.toString());
    EngagementService.MediaStats s = reloaded.stats("a.mp4");
    assertEquals("alice", s.creator);
    assertEquals(1, s.views);
    assertEquals(1, s.likes());
  }

  @Test
  void forgetRemovesTheEntry() {
    service.registerUpload("a.mp4", "alice");
    service.forget("a.mp4");
    assertEquals("anonymous", service.stats("a.mp4").creator);
  }
}
