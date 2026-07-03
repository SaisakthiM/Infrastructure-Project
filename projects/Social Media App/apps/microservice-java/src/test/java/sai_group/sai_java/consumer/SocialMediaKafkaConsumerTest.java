package sai_group.sai_java.consumer;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;
import org.mockito.quality.Strictness;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;

import reactor.core.publisher.Mono;
import sai_group.sai_java.model.ActivityFeed;
import sai_group.sai_java.model.KafkaEvents.*;
import sai_group.sai_java.model.Notification;
import sai_group.sai_java.repository.ActivityFeedRepository;
import sai_group.sai_java.repository.NotificationRepository;
import sai_group.sai_java.service.AnalyticsService;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SocialMediaKafkaConsumerTest {

    private SocialMediaKafkaConsumer consumer;

    private final NotificationRepository notificationRepo = Mockito.mock(NotificationRepository.class);
    private final ActivityFeedRepository activityFeedRepo = Mockito.mock(ActivityFeedRepository.class);
    private final AnalyticsService analyticsService = Mockito.mock(AnalyticsService.class);
    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        // Essential configuration so Jackson can comfortably process Java 8 Time variables (like Instant)
        objectMapper.registerModule(new JavaTimeModule());

        consumer = new SocialMediaKafkaConsumer(
            notificationRepo, 
            activityFeedRepo, 
            analyticsService, 
            objectMapper
        );
    }

    // ── post.created ─────────────────────────────────────────────────────────

    @Test
    void onPostCreated_fansOutToAllFollowers() throws Exception {
        // Mock the reactive save method to return an empty/dummy Mono instead of null
        when(activityFeedRepo.save(any(ActivityFeed.class))).thenReturn(Mono.just(new ActivityFeed()));

        PostCreatedEvent event = PostCreatedEvent.builder()
            .postId("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")
            .authorId("author-1")
            .authorUsername("alice")
            .authorAvatar("https://cdn.example.com/alice.jpg")
            .contentPreview("Hello world")
            .postType("post")
            .createdAt(Instant.now().toString())
            .followerIds(List.of("f1", "f2", "f3"))
            .build();

        consumer.onPostCreated(objectMapper.writeValueAsString(event));

        verify(activityFeedRepo, times(3)).save(any(ActivityFeed.class));
        verify(analyticsService).initPostAnalytics("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", "author-1");
    }

    @Test
    void onPostCreated_activityFeedHasCorrectFields() throws Exception {
        // Stub to ensure .block() receives a clean entity runtime wrapper rather than null
        when(activityFeedRepo.save(any(ActivityFeed.class))).thenReturn(Mono.just(new ActivityFeed()));

        PostCreatedEvent event = PostCreatedEvent.builder()
            .postId("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")
            .authorId("author-2")
            .authorUsername("bob")
            .contentPreview("Preview text")
            .postType("reel")
            .createdAt(Instant.parse("2025-06-01T12:00:00Z").toString())
            .followerIds(List.of("f10"))
            .build();

        consumer.onPostCreated(objectMapper.writeValueAsString(event));

        ArgumentCaptor<ActivityFeed> captor = ArgumentCaptor.forClass(ActivityFeed.class);
        verify(activityFeedRepo).save(captor.capture());

        ActivityFeed feed = captor.getValue();
        assertThat(feed.getUserId()).isEqualTo("f10");
        assertThat(feed.getAuthorId()).isEqualTo("author-2");
        assertThat(feed.getAuthorUsername()).isEqualTo("bob");
        assertThat(feed.getPostType()).isEqualTo("reel");
        assertThat(feed.getLikesCount()).isZero();
        assertThat(feed.getCommentsCount()).isZero();
    }

    // ── post.liked ────────────────────────────────────────────────────────────

    @Test
    void onPostLiked_savesNotificationAndIncrementsLike() throws Exception {
        // Stub notifications database call
        when(notificationRepo.save(any(Notification.class))).thenReturn(Mono.just(new Notification()));

        PostLikedEvent event = PostLikedEvent.builder()
            .postId("post-5")
            .postAuthorId("author-5")
            .senderId("liker-1")
            .senderUsername("charlie")
            .senderAvatar("https://cdn.example.com/charlie.jpg")
            .postThumbnail("https://cdn.example.com/thumb.jpg")
            .createdAt(Instant.now().toString())
            .build();

        consumer.onPostLiked(objectMapper.writeValueAsString(event));

        ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
        verify(notificationRepo).save(captor.capture());

        Notification n = captor.getValue();
        assertThat(n.getType()).isEqualTo("like");
        assertThat(n.getRecipientId()).isEqualTo("author-5");
        assertThat(n.getSenderId()).isEqualTo("liker-1");
        assertThat(n.isRead()).isFalse();

        verify(analyticsService).incrementLike("post-5", "author-5");
    }

    @Test
    void onPostLiked_skipsNotificationWhenSenderIsAuthor() throws Exception {
        PostLikedEvent event = PostLikedEvent.builder()
            .postId("post-6")
            .postAuthorId("author-6")
            .senderId("author-6")
            .senderUsername("dave")
            .createdAt(Instant.now().toString())
            .build();

        consumer.onPostLiked(objectMapper.writeValueAsString(event));

        verify(notificationRepo, never()).save(any());
        verify(analyticsService, never()).incrementLike(anyString(), anyString());
    }

    // ── post.commented ────────────────────────────────────────────────────────

    @Test
    void onPostCommented_savesCommentNotificationAndIncrementsCount() throws Exception {
        when(notificationRepo.save(any(Notification.class))).thenReturn(Mono.just(new Notification()));

        PostCommentedEvent event = PostCommentedEvent.builder()
            .postId("post-7")
            .postAuthorId("author-7")
            .senderId("commenter-1")
            .senderUsername("eve")
            .commentText("Great shot!")
            .createdAt(Instant.now().toString())
            .build();

        consumer.onPostCommented(objectMapper.writeValueAsString(event));

        ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
        verify(notificationRepo).save(captor.capture());

        Notification n = captor.getValue();
        assertThat(n.getType()).isEqualTo("comment");
        assertThat(n.getCommentText()).isEqualTo("Great shot!");

        verify(analyticsService).incrementComment("post-7", "author-7");
    }

    @Test
    void onPostCommented_skipsWhenSenderIsAuthor() throws Exception {
        PostCommentedEvent event = PostCommentedEvent.builder()
            .postId("post-8")
            .postAuthorId("author-8")
            .senderId("author-8")
            .commentText("Self comment")
            .createdAt(Instant.now().toString())
            .build();

        consumer.onPostCommented(objectMapper.writeValueAsString(event));

        verify(notificationRepo, never()).save(any());
    }

    // ── user.followed ─────────────────────────────────────────────────────────

    @Test
    void onUserFollowed_savesFollowNotification() throws Exception {
        when(notificationRepo.save(any(Notification.class))).thenReturn(Mono.just(new Notification()));

        UserFollowedEvent event = UserFollowedEvent.builder()
            .followerId("user-A")
            .followerUsername("frank")
            .followerAvatar("https://cdn.example.com/frank.jpg")
            .followingId("user-B")
            .createdAt(Instant.now().toString())
            .build();

        consumer.onUserFollowed(objectMapper.writeValueAsString(event));

        ArgumentCaptor<Notification> captor = ArgumentCaptor.forClass(Notification.class);
        verify(notificationRepo).save(captor.capture());

        Notification n = captor.getValue();
        assertThat(n.getType()).isEqualTo("follow");
        assertThat(n.getRecipientId()).isEqualTo("user-B");
        assertThat(n.getSenderId()).isEqualTo("user-A");
        assertThat(n.getSenderUsername()).isEqualTo("frank");
        assertThat(n.isRead()).isFalse();
    }

    // ── post.viewed ───────────────────────────────────────────────────────────

    @Test
    void onPostViewed_incrementsViewCount() throws Exception {
        PostViewedEvent event = PostViewedEvent.builder()
            .postId("post-9")
            .authorId("author-9")
            .viewerId("viewer-42")
            .createdAt(Instant.now().toString())
            .build();

        consumer.onPostViewed(objectMapper.writeValueAsString(event));

        verify(analyticsService).incrementView("post-9", "author-9", "viewer-42");
    }

    /* 
    @Test
    void onPostViewed_doesNotThrowOnBadJson() {
        assertThatCode(() -> consumer.onPostViewed("not json at all"))
            .doesNotThrowAnyException();
    }
    */
}