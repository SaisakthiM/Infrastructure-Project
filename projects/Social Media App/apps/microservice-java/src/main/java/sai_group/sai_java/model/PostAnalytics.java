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

/**
 * High-write analytics counter table.
 * Every post view, like, share writes here.
 * Cassandra handles millions of writes/sec with counters.
 */
@Table("post_analytics")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PostAnalytics {

    @PrimaryKeyColumn(name = "post_id", type = PrimaryKeyType.PARTITIONED)
    private String postId;

    @PrimaryKeyColumn(name = "author_id", type = PrimaryKeyType.CLUSTERED)
    private String authorId;

    @Column("view_count")
    private long viewCount;

    @Column("unique_viewers")
    private long uniqueViewers;

    @Column("like_count")
    private long likeCount;

    @Column("comment_count")
    private long commentCount;

    @Column("share_count")
    private long shareCount;

    @Column("save_count")
    private long saveCount;

    @Column("last_updated")
    private Instant lastUpdated;
}

