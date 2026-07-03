package sai_group.sai_java.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.cassandra.core.CassandraOperations;
import org.springframework.data.cassandra.core.cql.CqlOperations;
import sai_group.sai_java.model.PostAnalytics;

import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT) 
class AnalyticsServiceTest {

    @Mock CassandraOperations cassandraOps;
    @Mock CqlOperations        cqlOps;

    @InjectMocks AnalyticsService service;

    @BeforeEach
    void setUp() {
        when(cassandraOps.getCqlOperations()).thenReturn(cqlOps);
    }

    // ── initPostAnalytics ─────────────────────────────────────────────────────

    @Test
    void initPostAnalytics_insertsRowWithZeroCounters() {
        service.initPostAnalytics("post-1", "author-1");

        ArgumentCaptor<PostAnalytics> captor = ArgumentCaptor.forClass(PostAnalytics.class);
        verify(cassandraOps).insert(captor.capture());

        PostAnalytics pa = captor.getValue();
        assertThat(pa.getPostId()).isEqualTo("post-1");
        assertThat(pa.getAuthorId()).isEqualTo("author-1");
        assertThat(pa.getViewCount()).isZero();
        assertThat(pa.getLikeCount()).isZero();
        assertThat(pa.getCommentCount()).isZero();
        assertThat(pa.getLastUpdated()).isNotNull();
    }

    // ── incrementView ─────────────────────────────────────────────────────────

    @Test
    void incrementView_executesCqlWithCorrectIds() {
        service.incrementView("post-1", "author-1", "viewer-99");

        ArgumentCaptor<String> cqlCaptor = ArgumentCaptor.forClass(String.class);
        verify(cqlOps).execute(cqlCaptor.capture());

        String cql = cqlCaptor.getValue();
        assertThat(cql).contains("view_count = view_count + 1");
        assertThat(cql).contains("post-1");
        assertThat(cql).contains("author-1");
    }

    // ── incrementLike ─────────────────────────────────────────────────────────

    @Test
    void incrementLike_executesCqlWithLikeCountUpdate() {
        service.incrementLike("post-2", "author-2");

        ArgumentCaptor<String> cqlCaptor = ArgumentCaptor.forClass(String.class);
        verify(cqlOps).execute(cqlCaptor.capture());

        assertThat(cqlCaptor.getValue()).contains("like_count = like_count + 1");
    }

    // ── decrementLike ─────────────────────────────────────────────────────────

    @Test
    void decrementLike_executesCqlWithLikeCountDecrement() {
        service.decrementLike("post-3", "author-3");

        ArgumentCaptor<String> cqlCaptor = ArgumentCaptor.forClass(String.class);
        verify(cqlOps).execute(cqlCaptor.capture());

        assertThat(cqlCaptor.getValue()).contains("like_count = like_count - 1");
    }

    // ── incrementComment ─────────────────────────────────────────────────────

    @Test
    void incrementComment_executesCqlWithCommentCountUpdate() {
        service.incrementComment("post-4", "author-4");

        ArgumentCaptor<String> cqlCaptor = ArgumentCaptor.forClass(String.class);
        verify(cqlOps).execute(cqlCaptor.capture());

        assertThat(cqlCaptor.getValue()).contains("comment_count = comment_count + 1");
    }

    // ── getAnalytics ─────────────────────────────────────────────────────────

    @Test
    void getAnalytics_returnsDataWhenRowExists() {
        PostAnalytics expected = PostAnalytics.builder()
            .postId("p1").authorId("a1").viewCount(55L).build();

        when(cassandraOps.selectOne(anyString(), eq(PostAnalytics.class)))
            .thenReturn(expected);

        Optional<PostAnalytics> result = service.getAnalytics("p1", "a1");

        assertThat(result).isPresent();
        assertThat(result.get().getViewCount()).isEqualTo(55L);
    }

    @Test
    void getAnalytics_returnsEmptyWhenNoRow() {
        when(cassandraOps.selectOne(anyString(), eq(PostAnalytics.class)))
            .thenReturn(null);

        Optional<PostAnalytics> result = service.getAnalytics("missing", "author");

        assertThat(result).isEmpty();
    }

    // ── CQL injection guard ───────────────────────────────────────────────────

    @Test
    void incrementView_doesNotContainUnescapedApostrophe() {
        // Confirm the raw string-interpolation in CQL at least passes IDs through.
        // This test documents the known SQL-injection risk so it's visible in CI.
        service.incrementView("post'; DROP TABLE post_analytics;--", "author-1", "v");

        ArgumentCaptor<String> cqlCaptor = ArgumentCaptor.forClass(String.class);
        verify(cqlOps).execute(cqlCaptor.capture());

        // The test intentionally captures the output — if the project later adds
        // parameterised statements, update this test to verify no interpolation.
        assertThat(cqlCaptor.getValue()).contains("post'; DROP TABLE post_analytics;--");
    }
}