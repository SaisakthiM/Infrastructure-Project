package sai_group.sai_java;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.cassandra.core.ReactiveCassandraTemplate;

import sai_group.sai_java.repository.ActivityFeedRepository;
import sai_group.sai_java.repository.NotificationRepository;
import sai_group.sai_java.repository.UserRepository;
import sai_group.sai_java.service.AnalyticsService;

import static org.mockito.Mockito.mock;

import org.mockito.Mockito;

@Configuration
public class TestConfig {

    @Bean
    public NotificationRepository notificationRepository() {
        return mock(NotificationRepository.class);
    }

    @Bean
    public ActivityFeedRepository activityFeedRepository() {
        return mock(ActivityFeedRepository.class);
    }

    @Bean
    public UserRepository userRepository() {
        return mock(UserRepository.class);
    }

    @Bean
    public AnalyticsService analyticsService() {
        return mock(AnalyticsService.class);
    }

    @Bean
    public ObjectMapper objectMapper() {
        return new ObjectMapper();
    }
    @Bean
    public ReactiveCassandraTemplate reactiveCassandraTemplate() {
        // Returns a mock instance to satisfy the dependency tree injection requirements
        return Mockito.mock(ReactiveCassandraTemplate.class);
    }
}