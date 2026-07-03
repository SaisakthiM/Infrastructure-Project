package sai_group.sai_java.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import sai_group.sai_java.model.ActivityFeed;
import sai_group.sai_java.model.Notification;
import sai_group.sai_java.model.PostAnalytics;
import sai_group.sai_java.repository.ActivityFeedRepository;
import sai_group.sai_java.repository.NotificationRepository;
import sai_group.sai_java.service.AnalyticsService;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/java")
public class SocialController {

    private final NotificationRepository  notificationRepo;
    private final ActivityFeedRepository  activityFeedRepo;
    private final AnalyticsService        analyticsService;

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of("status", "healthy", "service", "java-microservice"));
    }

    // ── Notifications ─────────────────────────────────────────────────────────
    @GetMapping("/notifications/{userId}")
    public ResponseEntity<List<Notification>> getNotifications(
            @PathVariable String userId,
            @RequestParam(defaultValue = "20") int limit) {
        List<Notification> notifs = notificationRepo
                .findByRecipientIdLimit(userId, limit)
                .collectList()
                .defaultIfEmpty(Collections.emptyList())
                .block();
        return ResponseEntity.ok(notifs != null ? notifs : Collections.emptyList());
    }

    @GetMapping("/notifications/{userId}/unread-count")
    public ResponseEntity<Map<String, Long>> getUnreadCount(@PathVariable String userId) {
        Long count = notificationRepo.countUnread(userId).defaultIfEmpty(0L).block();
        return ResponseEntity.ok(Map.of("count", count != null ? count : 0L));
    }

    @PostMapping("/notifications/{userId}/mark-read")
    public ResponseEntity<Map<String, String>> markRead(@PathVariable String userId) {
        notificationRepo.findByRecipientIdLimit(userId, 100)
            .doOnNext(n -> {
                n.setRead(true);
                notificationRepo.save(n).subscribe();
            })
            .blockLast();
        return ResponseEntity.ok(Map.of("status", "marked-read"));
    }

    // ── Activity Feed ─────────────────────────────────────────────────────────
    @GetMapping("/feed/{userId}")
    public ResponseEntity<List<ActivityFeed>> getFeed(
            @PathVariable String userId,
            @RequestParam(defaultValue = "20") int limit) {
        List<ActivityFeed> feed = activityFeedRepo
                .findByUserIdLimit(userId, limit)
                .collectList()
                .defaultIfEmpty(Collections.emptyList())
                .block();
        return ResponseEntity.ok(feed != null ? feed : Collections.emptyList());
    }

    // ── Analytics ─────────────────────────────────────────────────────────────
    @GetMapping("/analytics/{postId}")
    public ResponseEntity<?> getAnalytics(
            @PathVariable String postId,
            @RequestParam String authorId) {
        Optional<PostAnalytics> analytics = analyticsService.getAnalytics(postId, authorId);
        return analytics.<ResponseEntity<?>>map(ResponseEntity::ok)
                        .orElse(ResponseEntity.notFound().build());
    }
}
