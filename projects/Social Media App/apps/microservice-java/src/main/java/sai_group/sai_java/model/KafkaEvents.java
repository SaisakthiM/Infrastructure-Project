package sai_group.sai_java.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Kafka event DTOs — these mirror exactly what Django publishes.
 * Keep in sync with django-kafka/events.py
 */
public class KafkaEvents {

    /** Published when a user creates a post */
    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class PostCreatedEvent {
        private String postId;
        private String authorId;
        private String authorUsername;
        private String authorAvatar;
        private String contentPreview;  // first 120 chars
        private String thumbnailUrl;    // first media item
        private String postType;        // post | reel
        private String createdAt;       // ISO-8601
        // List of follower IDs to fan-out to (Django sends these)
        private java.util.List<String> followerIds;
    }

    /** Published when a user likes a post */
    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class PostLikedEvent {
        private String postId;
        private String postAuthorId;
        private String senderId;
        private String senderUsername;
        private String senderAvatar;
        private String postThumbnail;
        private String createdAt;
    }

    /** Published when a user comments on a post */
    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class PostCommentedEvent {
        private String postId;
        private String postAuthorId;
        private String senderId;
        private String senderUsername;
        private String senderAvatar;
        private String postThumbnail;
        private String commentText;
        private String createdAt;
    }

    /** Published when a user follows another */
    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class UserFollowedEvent {
        private String followerId;
        private String followerUsername;
        private String followerAvatar;
        private String followingId;     // the person being followed (recipient)
        private String createdAt;
    }

    /** Published when a post is viewed */
    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class PostViewedEvent {
        private String postId;
        private String authorId;
        private String viewerId;
        private String createdAt;
    }
}

