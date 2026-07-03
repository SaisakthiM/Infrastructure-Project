package sai_group.sai_java.controller;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import sai_group.sai_java.model.ActivityFeed;
import sai_group.sai_java.model.Notification;
import sai_group.sai_java.model.PostAnalytics;
import sai_group.sai_java.repository.ActivityFeedRepository;
import sai_group.sai_java.repository.NotificationRepository;
import sai_group.sai_java.service.AnalyticsService;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
class SocialControllerTest {

    @Mock NotificationRepository  notificationRepo;
    @Mock ActivityFeedRepository  activityFeedRepo;
    @Mock AnalyticsService        analyticsService;

    @InjectMocks SocialController controller;

    MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.standaloneSetup(controller).build();
    }

    // ── Health ────────────────────────────────────────────────────────────────

    @Test
    void health_returns200WithServiceName() throws Exception {
        mvc.perform(get("/api/java/health"))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.status").value("healthy"))
           .andExpect(jsonPath("$.service").value("java-microservice"));
    }

    // ── Notifications ─────────────────────────────────────────────────────────

    @Test
    void getNotifications_returnsListForUser() throws Exception {
        Notification n1 = Notification.builder()
            .recipientId("user-1")
            .id(UUID.randomUUID())
            .createdAt(Instant.now())
            .senderId("user-2")
            .senderUsername("alice")
            .type("like")
            .isRead(false)
            .build();

        when(notificationRepo.findByRecipientIdLimit(eq("user-1"), anyInt()))
            .thenReturn(Flux.just(n1));

        mvc.perform(get("/api/java/notifications/user-1"))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$", hasSize(1)))
           .andExpect(jsonPath("$[0].type").value("like"))
           .andExpect(jsonPath("$[0].senderUsername").value("alice"));
    }

    @Test
    void getNotifications_returnsEmptyListWhenNone() throws Exception {
        when(notificationRepo.findByRecipientIdLimit(anyString(), anyInt()))
            .thenReturn(Flux.empty());

        mvc.perform(get("/api/java/notifications/unknown-user"))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void getNotifications_respectsLimitParam() throws Exception {
        when(notificationRepo.findByRecipientIdLimit(eq("user-1"), eq(5)))
            .thenReturn(Flux.empty());

        mvc.perform(get("/api/java/notifications/user-1").param("limit", "5"))
           .andExpect(status().isOk());

        verify(notificationRepo).findByRecipientIdLimit("user-1", 5);
    }

    @Test
    void getUnreadCount_returnsCount() throws Exception {
        when(notificationRepo.countUnread("user-1")).thenReturn(Mono.just(7L));

        mvc.perform(get("/api/java/notifications/user-1/unread-count"))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.count").value(7));
    }

    @Test
    void getUnreadCount_returnsZeroWhenNull() throws Exception {
        when(notificationRepo.countUnread("user-1")).thenReturn(Mono.empty());

        mvc.perform(get("/api/java/notifications/user-1/unread-count"))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.count").value(0));
    }

    @Test
    void markRead_returns200AndTriggersUpdate() throws Exception {
        Notification unread = Notification.builder()
            .recipientId("user-1")
            .id(UUID.randomUUID())
            .createdAt(Instant.now())
            .senderId("user-2")
            .type("follow")
            .isRead(false)
            .build();

        when(notificationRepo.findByRecipientIdLimit(eq("user-1"), anyInt()))
            .thenReturn(Flux.just(unread));
        when(notificationRepo.save(any())).thenReturn(Mono.just(unread));

        mvc.perform(post("/api/java/notifications/user-1/mark-read"))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.status").value("marked-read"));
    }

    // ── Activity feed ─────────────────────────────────────────────────────────

    @Test
    void getFeed_returnsActivitiesForUser() throws Exception {
        ActivityFeed entry = ActivityFeed.builder()
            .userId("user-1")
            .postId(UUID.randomUUID())
            .authorId("user-2")
            .authorUsername("bob")
            .postType("post")
            .createdAt(Instant.now())
            .likesCount(5)
            .commentsCount(2)
            .build();

        when(activityFeedRepo.findByUserIdLimit(eq("user-1"), anyInt()))
            .thenReturn(Flux.just(entry));

        mvc.perform(get("/api/java/feed/user-1"))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$", hasSize(1)))
           .andExpect(jsonPath("$[0].authorUsername").value("bob"))
           .andExpect(jsonPath("$[0].likesCount").value(5));
    }

    @Test
    void getFeed_returnsEmptyList() throws Exception {
        when(activityFeedRepo.findByUserIdLimit(anyString(), anyInt()))
            .thenReturn(Flux.empty());

        mvc.perform(get("/api/java/feed/user-99"))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$", hasSize(0)));
    }

    // ── Analytics ─────────────────────────────────────────────────────────────

    @Test
    void getAnalytics_returnsDataWhenFound() throws Exception {
        PostAnalytics pa = PostAnalytics.builder()
            .postId("p1")
            .authorId("a1")
            .viewCount(100)
            .likeCount(42)
            .commentCount(7)
            .build();

        when(analyticsService.getAnalytics("p1", "a1")).thenReturn(Optional.of(pa));

        mvc.perform(get("/api/java/analytics/p1").param("authorId", "a1"))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.viewCount").value(100))
           .andExpect(jsonPath("$.likeCount").value(42));
    }

    @Test
    void getAnalytics_returns404WhenMissing() throws Exception {
        when(analyticsService.getAnalytics(anyString(), anyString()))
            .thenReturn(Optional.empty());

        mvc.perform(get("/api/java/analytics/missing").param("authorId", "a1"))
           .andExpect(status().isNotFound());
    }
}