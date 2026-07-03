package sai_group.sai_java.repository;

import org.springframework.data.cassandra.repository.Query;
import org.springframework.data.cassandra.repository.ReactiveCassandraRepository;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import sai_group.sai_java.model.ActivityFeed;

@Repository
public interface ActivityFeedRepository extends ReactiveCassandraRepository<ActivityFeed, String> {

    @Query("SELECT * FROM activity_feed WHERE user_id = ?0 LIMIT ?1")
    Flux<ActivityFeed> findByUserIdLimit(String userId, int limit);
}
