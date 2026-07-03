package sai_group.sai_java.consumer;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;
import sai_group.sai_java.model.ActivityFeed;
import sai_group.sai_java.model.KafkaEvents.*;
import sai_group.sai_java.model.Notification;
import sai_group.sai_java.repository.ActivityFeedRepository;
import sai_group.sai_java.repository.NotificationRepository;
import sai_group.sai_java.service.AnalyticsService;

import java.time.Instant;
import java.util.UUID;

@Slf4j
@Component
@RequiredArgsConstructor
public class SocialMediaKafkaConsumer {

    private final NotificationRepository  notificationRepo;
    private final ActivityFeedRepository  activityFeedRepo;
    private final AnalyticsService        analyticsService;
    private final ObjectMapper            objectMapper;

    @KafkaListener(topics = "post.created", groupId = "java-consumer")
    public void onPostCreated(String message) {
        try {
            PostCreatedEvent event = objectMapper.readValue(message, PostCreatedEvent.class);
            log.info("Fan-out post {} to {} followers", event.getPostId(), event.getFollowerIds().size());
            Instant createdAt = Instant.parse(event.getCreatedAt());

            event.getFollowerIds().forEach(followerId -> {
                ActivityFeed entry = ActivityFeed.builder()
                    .userId(followerId)
                    .postId(UUID.fromString(event.getPostId()))
                    .authorId(event.getAuthorId())
                    .authorUsername(event.getAuthorUsername())
                    .authorAvatar(event.getAuthorAvatar())
                    .contentPreview(event.getContentPreview())
                    .thumbnailUrl(event.getThumbnailUrl())
                    .postType(event.getPostType())
                    .createdAt(createdAt)
                    .likesCount(0)
                    .commentsCount(0)
                    .build();
                // Reactive save — block() to ensure write before moving on
                activityFeedRepo.save(entry).block();
            });

            analyticsService.initPostAnalytics(event.getPostId(), event.getAuthorId());

        } catch (Exception e) {
            log.error("Error processing post.created: {}", e.getMessage(), e);
        }
    }

    @KafkaListener(topics = "post.liked", groupId = "java-consumer")
    public void onPostLiked(String message) {
        try {
            PostLikedEvent event = objectMapper.readValue(message, PostLikedEvent.class);
            if (event.getSenderId().equals(event.getPostAuthorId())) return;

            Notification notif = Notification.builder()
                .recipientId(event.getPostAuthorId())
                .id(UUID.randomUUID())
                .createdAt(Instant.parse(event.getCreatedAt()))
                .senderId(event.getSenderId())
                .senderUsername(event.getSenderUsername())
                .senderAvatar(event.getSenderAvatar())
                .type("like")
                .postId(event.getPostId())
                .postThumbnail(event.getPostThumbnail())
                .isRead(false)
                .build();

            notificationRepo.save(notif).block();
            analyticsService.incrementLike(event.getPostId(), event.getPostAuthorId());

        } catch (Exception e) {
            log.error("Error processing post.liked: {}", e.getMessage(), e);
        }
    }

    @KafkaListener(topics = "post.commented", groupId = "java-consumer")
    public void onPostCommented(String message) {
        try {
            PostCommentedEvent event = objectMapper.readValue(message, PostCommentedEvent.class);
            if (event.getSenderId().equals(event.getPostAuthorId())) return;

            Notification notif = Notification.builder()
                .recipientId(event.getPostAuthorId())
                .id(UUID.randomUUID())
                .createdAt(Instant.parse(event.getCreatedAt()))
                .senderId(event.getSenderId())
                .senderUsername(event.getSenderUsername())
                .senderAvatar(event.getSenderAvatar())
                .type("comment")
                .postId(event.getPostId())
                .postThumbnail(event.getPostThumbnail())
                .commentText(event.getCommentText())
                .isRead(false)
                .build();

            notificationRepo.save(notif).block();
            analyticsService.incrementComment(event.getPostId(), event.getPostAuthorId());

        } catch (Exception e) {
            log.error("Error processing post.commented: {}", e.getMessage(), e);
        }
    }

    @KafkaListener(topics = "user.followed", groupId = "java-consumer")
    public void onUserFollowed(String message) {
        try {
            UserFollowedEvent event = objectMapper.readValue(message, UserFollowedEvent.class);

            Notification notif = Notification.builder()
                .recipientId(event.getFollowingId())
                .id(UUID.randomUUID())
                .createdAt(Instant.parse(event.getCreatedAt()))
                .senderId(event.getFollowerId())
                .senderUsername(event.getFollowerUsername())
                .senderAvatar(event.getFollowerAvatar())
                .type("follow")
                .isRead(false)
                .build();

            notificationRepo.save(notif).block();

        } catch (Exception e) {
            log.error("Error processing user.followed: {}", e.getMessage(), e);
        }
    }

    @KafkaListener(topics = "post.viewed", groupId = "java-consumer")
    public void onPostViewed(String message) {
        try {
            PostViewedEvent event = objectMapper.readValue(message, PostViewedEvent.class);
            analyticsService.incrementView(event.getPostId(), event.getAuthorId(), event.getViewerId());
        } catch (Exception e) {
            log.error("Error processing post.viewed: {}", e.getMessage(), e);
        }
    }
}
