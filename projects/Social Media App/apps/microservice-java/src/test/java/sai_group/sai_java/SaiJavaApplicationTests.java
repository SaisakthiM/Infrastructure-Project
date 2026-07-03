package sai_group.sai_java;

import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.autoconfigure.cassandra.CassandraAutoConfiguration;
import org.springframework.boot.autoconfigure.data.cassandra.CassandraDataAutoConfiguration;
import org.springframework.boot.autoconfigure.data.cassandra.CassandraReactiveDataAutoConfiguration;
import org.springframework.boot.autoconfigure.data.cassandra.CassandraRepositoriesAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.kafka.test.context.EmbeddedKafka;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import sai_group.sai_java.repository.ActivityFeedRepository;
import sai_group.sai_java.repository.NotificationRepository;
import sai_group.sai_java.repository.UserRepository;

@SpringBootTest(properties = "spring.main.allow-bean-definition-overriding=true")
@Import(TestConfig.class)
@EnableAutoConfiguration(exclude = {
    CassandraAutoConfiguration.class,
    CassandraDataAutoConfiguration.class,
    CassandraReactiveDataAutoConfiguration.class,
    CassandraRepositoriesAutoConfiguration.class
})
@ActiveProfiles("test")
@EmbeddedKafka(kraft = true, partitions = 1, topics = {
    "post.created", "post.liked", "post.commented", "post.viewed", "user.followed"
})
class SaiJavaApplicationTests {

    @MockitoBean
    private NotificationRepository notificationRepository;

    @MockitoBean
    private ActivityFeedRepository activityFeedRepository;

    @MockitoBean
    private UserRepository userRepository;

    @Test
    void contextLoads() {
    }
}