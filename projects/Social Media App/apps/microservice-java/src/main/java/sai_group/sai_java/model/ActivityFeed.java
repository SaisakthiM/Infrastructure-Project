package sai_group.sai_java.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.cassandra.core.cql.PrimaryKeyType;
import org.springframework.data.cassandra.core.mapping.Column;
import org.springframework.data.cassandra.core.mapping.PrimaryKeyColumn;
import org.springframework.data.cassandra.core.mapping.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * Fan-out feed table.
 *
 * When user A (followed by users B, C, D) creates a post,
 * Kafka event triggers Java to write one row per follower:
 *   feed[B] += postId
 *   feed[C] += postId
 *   feed[D] += postId
 *
 * This makes reading B's feed an O(1) Cassandra partition scan,
 * instead of a slow JOIN across follows + posts in Postgres.
 */
@Table("activity_feed")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ActivityFeed {

    @PrimaryKeyColumn(name = "user_id", type = PrimaryKeyType.PARTITIONED)
    private String userId;

    @PrimaryKeyColumn(name = "created_at", type = PrimaryKeyType.CLUSTERED,
                      ordering = org.springframework.data.cassandra.core.cql.Ordering.DESCENDING)
    private Instant createdAt;

    @PrimaryKeyColumn(name = "post_id", type = PrimaryKeyType.CLUSTERED)
    private UUID postId;

    @Column("author_id")
    private String authorId;

    @Column("author_username")
    private String authorUsername;

    @Column("author_avatar")
    private String authorAvatar;

    @Column("content_preview")
    private String contentPreview;

    @Column("thumbnail_url")
    private String thumbnailUrl;

    // post | reel | story
    @Column("post_type")
    private String postType;

    @Column("likes_count")
    private int likesCount;

    @Column("comments_count")
    private int commentsCount;
}

