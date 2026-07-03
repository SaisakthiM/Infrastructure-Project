package com.bankmanagement.bank_management.repo;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.transaction.annotation.Transactional;

import com.bankmanagement.bank_management.database.Bank;
import com.bankmanagement.bank_management.repository.BankRepository;

@DataJpaTest
@Transactional
public class BankRepositoryTest {

    @Autowired
    BankRepository bankRepository;

    @BeforeEach
    void setUp() {
        Bank bank = new Bank();
        bank.setAccountNumber("BC001");
        bank.setCustomerName("John");
        bank.setBalance(1000L);
        bankRepository.save(bank);
    }

    @Test 
    void accountNotExists_findByAccountNumber_assertFalse() {
        Optional<Bank> result = bankRepository.findByAccountNumber("NOTEXIST");
        assertFalse(result.isPresent());
    }
    @Test
    void accountExists_findByAccountNumber_assertTrue() {
        Optional<Bank> result = bankRepository.findByAccountNumber("BC001");
        assertEquals("BC001", result.get().getAccountNumber());
    }
    @Test
    void existsByAccountNumber_exists() {
        boolean exists = bankRepository.existsByAccountNumber("BC001");
        assertTrue(exists);
    }

    @Test
    void existsByAccountNumber_notExists() {
        boolean exists = bankRepository.existsByAccountNumber("NOTEXIST");
        assertFalse(exists);
    }
}