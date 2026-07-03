package com.bankmanagement.bank_management.repository;

import com.bankmanagement.bank_management.database.Bank;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface BankRepository extends JpaRepository<Bank, Long> {
    Optional<Bank> findByAccountNumber(String accountNumber);
    boolean existsByAccountNumber(String accountNumber);
}
