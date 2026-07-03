package com.bankmanagement.bank_management.repository;

import com.bankmanagement.bank_management.database.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByUsername(String username);
    boolean existsByUsername(String username);
    Optional<User> findByAccount_Id(Long accountId);
}
