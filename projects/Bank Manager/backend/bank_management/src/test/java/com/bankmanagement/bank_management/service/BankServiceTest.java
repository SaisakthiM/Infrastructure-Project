package com.bankmanagement.bank_management.service;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import static org.mockito.ArgumentMatchers.any;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.annotation.Autowired;

import com.bankmanagement.bank_management.database.Bank;
import com.bankmanagement.bank_management.dto.AccountRequest;
import com.bankmanagement.bank_management.dto.AccountResponse;
import com.bankmanagement.bank_management.repository.BankRepository;

@ExtendWith(MockitoExtension.class)
public class BankServiceTest {

    @Mock
    BankRepository bankRepository;

    @InjectMocks
    BankService bankService;

    @Autowired
    BankService service;

    @Test
    void ExistAccount_createAccount_shouldThrow() {
        AccountRequest request = new AccountRequest();
        request.setAccountNumber("ACC001");
        request.setCustomerName("John");
        when(bankRepository.existsByAccountNumber("ACC001")).thenReturn(true);
        assertThrows(IllegalArgumentException.class, () -> {
            bankService.createAccount(request);
        });
    }

    @Test
    void nonExistsAccount_createAccount_shouldCreate() {
        AccountRequest request = new AccountRequest();
        request.setAccountNumber("BC001");
        request.setCustomerName("John");

        Bank savedBank = new Bank();
        savedBank.setAccountNumber("BC001");
        savedBank.setCustomerName("John");
        savedBank.setBalance(0L);

        when(bankRepository.existsByAccountNumber("BC001")).thenReturn(false);
        when(bankRepository.save(any())).thenReturn(savedBank);

        AccountResponse response = bankService.createAccount(request);

        assertEquals("BC001", response.getAccountNumber());
        assertEquals("John", response.getCustomerName());
        assertEquals(0L, response.getBalance());
    }

    @Test
    void notFound_getAccountById_shouldThrow() {
        // ARRANGE — repo returns nothing for this ID
        when(bankRepository.findById(1L)).thenReturn(Optional.empty());

        // ACT + ASSERT
        assertThrows(IllegalArgumentException.class, () -> {
            bankService.getAccountById(1L);
        });
    }

    @Test
    void accountFound_getAccountById_Success() {
        Bank savedBank = new Bank();
        savedBank.setAccountNumber("BC001");
        savedBank.setId(1L);
        savedBank.setCustomerName("John");
        savedBank.setBalance(0L);

        when(bankRepository.findById(1L)).thenReturn(Optional.of(savedBank));

        AccountResponse response = bankService.getAccountById(1L);
        assertEquals(1L, response.getId());
        assertEquals("BC001", response.getAccountNumber());
        assertEquals("John", response.getCustomerName());
    }

    @Test
    void negativeDeposit_deposit_shouldThrow() {
        Bank savedBank = new Bank();
        savedBank.setAccountNumber("BC001");
        savedBank.setId(1L);
        savedBank.setCustomerName("John");
        savedBank.setBalance(0L);

        assertThrows(IllegalArgumentException.class, () -> {
            bankService.deposit(1L, -2L);
        });
    }

    @Test
    void moneyDeposit_deposit_success() {
        Bank savedBank = new Bank();
        savedBank.setAccountNumber("BC001");
        savedBank.setId(1L);
        savedBank.setCustomerName("John");
        savedBank.setBalance(0L);

        when(bankRepository.findById(1L)).thenReturn(Optional.of(savedBank));
        when(bankRepository.save(any())).thenReturn(savedBank);

        AccountResponse response = bankService.deposit(1L, 20L);
        assertEquals(1L, response.getId());
        assertEquals("BC001", response.getAccountNumber());
        assertEquals("John", response.getCustomerName());
    }

    @Test
    void excessWithdraw_withdraw_shouldThrow() {
        Bank savedBank = new Bank();
        savedBank.setAccountNumber("BC001");
        savedBank.setId(1L);
        savedBank.setCustomerName("John");
        savedBank.setBalance(0L);

        when(bankRepository.findById(1L)).thenReturn(Optional.of(savedBank));

        assertThrows(IllegalArgumentException.class, () -> {bankService.withdraw(1L, 10000L);});
    }

    @Test
    void havingWithdraw_withdraw_success() {
        Bank savedBank = new Bank();
        savedBank.setAccountNumber("BC001");
        savedBank.setId(1L);
        savedBank.setCustomerName("John");
        savedBank.setBalance(1000L);

        when(bankRepository.findById(1L)).thenReturn(Optional.of(savedBank));
        when(bankRepository.save(any())).thenReturn(savedBank);

        AccountResponse response = bankService.withdraw(1L, 100L);

        assertEquals(1L, response.getId());
        assertEquals("BC001", response.getAccountNumber());
        assertEquals("John", response.getCustomerName());
        assertEquals(900L, response.getBalance());
    }

    @Test
    void negativeWithdraw_withdraw_shouldThrow() {
        Bank savedBank = new Bank();
        savedBank.setAccountNumber("BC001");
        savedBank.setId(1L);
        savedBank.setCustomerName("John");
        savedBank.setBalance(0L);

        assertThrows(IllegalArgumentException.class, () -> {bankService.withdraw(1L, -4L);});
    }

}
