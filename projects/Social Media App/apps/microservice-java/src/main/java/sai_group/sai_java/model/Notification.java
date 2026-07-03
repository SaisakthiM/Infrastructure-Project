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

@Table("notifications")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Notification {

    // Partition key: one partition per recipient — fast reads for a user's feed
    @PrimaryKeyColumn(name = "recipient_id", type = PrimaryKeyType.PARTITIONED)
    private String recipientId;

    // Clustering key descending: newest first without sorting
    @PrimaryKeyColumn(name = "created_at", type = PrimaryKeyType.CLUSTERED,
                      ordering = org.springframework.data.cassandra.core.cql.Ordering.DESCENDING)
    private Instant createdAt;

    @PrimaryKeyColumn(name = "id", type = PrimaryKeyType.CLUSTERED)
    private UUID id;

    @Column("sender_id")
    private String senderId;

    @Column("sender_username")
    private String senderUsername;

    @Column("sender_avatar")
    private String senderAvatar;

    // like | comment | follow | mention | reply
    @Column("type")
    private String type;

    @Column("post_id")
    private String postId;

    @Column("post_thumbnail")
    private String postThumbnail;

    @Column("comment_text")
    private String commentText;

    @Column("is_read")
    private boolean isRead;
}

