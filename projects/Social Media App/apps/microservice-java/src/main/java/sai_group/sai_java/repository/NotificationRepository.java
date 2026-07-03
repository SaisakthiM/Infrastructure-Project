package sai_group.sai_java.repository;

import org.springframework.data.cassandra.repository.Query;
import org.springframework.data.cassandra.repository.ReactiveCassandraRepository;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import sai_group.sai_java.model.Notification;

@Repository
public interface NotificationRepository extends ReactiveCassandraRepository<Notification, String> {

    @Query("SELECT * FROM notifications WHERE recipient_id = ?0 LIMIT ?1")
    Flux<Notification> findByRecipientIdLimit(String recipientId, int limit);

    @Query("SELECT COUNT(*) FROM notifications WHERE recipient_id = ?0 AND is_read = false ALLOW FILTERING")
    Mono<Long> countUnread(String recipientId);
}
