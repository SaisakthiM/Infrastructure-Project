package sai_group.sai_java.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.cassandra.core.CassandraOperations;
import org.springframework.stereotype.Service;
import sai_group.sai_java.model.PostAnalytics;

import java.time.Instant;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class AnalyticsService {

    private final CassandraOperations cassandraOps;

    public void initPostAnalytics(String postId, String authorId) {
        PostAnalytics analytics = PostAnalytics.builder()
            .postId(postId)
            .authorId(authorId)
            .viewCount(0)
            .uniqueViewers(0)
            .likeCount(0)
            .commentCount(0)
            .shareCount(0)
            .saveCount(0)
            .lastUpdated(Instant.now())
            .build();
        cassandraOps.insert(analytics);
    }

    public void incrementView(String postId, String authorId, String viewerId) {
        // Use Cassandra lightweight transactions for idempotent counters
        String cql = String.format(
            "UPDATE post_analytics SET view_count = view_count + 1, last_updated = toTimestamp(now()) " +
            "WHERE post_id = '%s' AND author_id = '%s'", postId, authorId);
        cassandraOps.getCqlOperations().execute(cql);
    }

    public void incrementLike(String postId, String authorId) {
        String cql = String.format(
            "UPDATE post_analytics SET like_count = like_count + 1, last_updated = toTimestamp(now()) " +
            "WHERE post_id = '%s' AND author_id = '%s'", postId, authorId);
        cassandraOps.getCqlOperations().execute(cql);
    }

    public void decrementLike(String postId, String authorId) {
        String cql = String.format(
            "UPDATE post_analytics SET like_count = like_count - 1, last_updated = toTimestamp(now()) " +
            "WHERE post_id = '%s' AND author_id = '%s'", postId, authorId);
        cassandraOps.getCqlOperations().execute(cql);
    }

    public void incrementComment(String postId, String authorId) {
        String cql = String.format(
            "UPDATE post_analytics SET comment_count = comment_count + 1, last_updated = toTimestamp(now()) " +
            "WHERE post_id = '%s' AND author_id = '%s'", postId, authorId);
        cassandraOps.getCqlOperations().execute(cql);
    }

    public Optional<PostAnalytics> getAnalytics(String postId, String authorId) {
        return Optional.ofNullable(
            cassandraOps.selectOne(
                com.datastax.oss.driver.api.querybuilder.QueryBuilder.selectFrom("post_analytics")
                    .all()
                    .whereColumn("post_id").isEqualTo(
                        com.datastax.oss.driver.api.querybuilder.QueryBuilder.literal(postId))
                    .whereColumn("author_id").isEqualTo(
                        com.datastax.oss.driver.api.querybuilder.QueryBuilder.literal(authorId))
                    .build().getQuery(),
                PostAnalytics.class
            )
        );
    }
}

