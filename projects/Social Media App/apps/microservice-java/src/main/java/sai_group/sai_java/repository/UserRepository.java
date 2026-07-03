package sai_group.sai_java.repository;

import org.springframework.data.cassandra.repository.ReactiveCassandraRepository;
import org.springframework.stereotype.Repository;
import sai_group.sai_java.model.User;

@Repository
public interface UserRepository extends ReactiveCassandraRepository<User, String> {}
