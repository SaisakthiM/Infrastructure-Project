package com.bankmanagement.bank_management.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.bankmanagement.bank_management.database.Bank;
import com.bankmanagement.bank_management.database.User;
import com.bankmanagement.bank_management.dto.AccountRequest;
import com.bankmanagement.bank_management.dto.AccountResponse;
import com.bankmanagement.bank_management.repository.BankRepository;
import com.bankmanagement.bank_management.repository.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class BankService {

    @Autowired
    private final BankRepository bankRepository;

    @Autowired
    private final UserRepository userRepository;

    // ✅ Single helper — always updates both Bank and User together
    private void syncCreditScore(Bank account, User user, Long newScore) {
        user.setCreditScore(newScore);
        account.setCreditScore(newScore.intValue());
    }

    @Transactional
    public AccountResponse createAccount(AccountRequest request) {
        if (bankRepository.existsByAccountNumber(request.getAccountNumber())) {
            throw new IllegalArgumentException("Account number already exists");
        }

        Bank account = new Bank();
        account.setCustomerName(request.getCustomerName());
        account.setAccountNumber(request.getAccountNumber());
        account.setCreditScore(700);
        account.setBalance(0L);
        account.setCreatedAt(LocalDateTime.now());
        account.setUpdatedAt(LocalDateTime.now());

        Bank savedAccount = bankRepository.save(account);
        return mapToResponse(savedAccount);
    }

    public AccountResponse getAccountById(Long id) {
        Bank account = bankRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Account not found with ID: " + id));
        return mapToResponse(account);
    }

    public List<AccountResponse> getAllAccounts() {
        return bankRepository.findAll()
                .stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public AccountResponse deposit(Long accountId, Long amount) {
        if (amount <= 0) {
            throw new IllegalArgumentException("Deposit amount must be positive");
        }

        Bank account = bankRepository.findById(accountId)
                .orElseThrow(() -> new IllegalArgumentException("Account not found"));

        account.setBalance(account.getBalance() + amount);
        account.setUpdatedAt(LocalDateTime.now());
        account.setDescription(account.getDescription());

        Bank updatedAccount = bankRepository.save(account);
        return mapToResponse(updatedAccount);
    }

    @Transactional
    public AccountResponse withdraw(Long accountId, Long amount) {
        if (amount <= 0) {
            throw new IllegalArgumentException("Withdrawal amount must be positive");
        }

        Bank account = bankRepository.findById(accountId)
                .orElseThrow(() -> new IllegalArgumentException("Account not found"));

        if (account.getBalance() < amount) {
            throw new IllegalArgumentException("Insufficient balance. Current balance: " + account.getBalance());
        }

        account.setBalance(account.getBalance() - amount);
        account.setUpdatedAt(LocalDateTime.now());
        account.setDescription(account.getDescription());

        Bank updatedAccount = bankRepository.save(account);
        return mapToResponse(updatedAccount);
    }

    @Transactional
    public AccountResponse loan(Long accountId, Long amount) {
        if (amount <= 0) {
            throw new IllegalArgumentException("Loan amount must be positive");
        }

        Bank account = bankRepository.findById(accountId)
                .orElseThrow(() -> new IllegalArgumentException("Account not found"));

        User user = userRepository.findByAccount_Id(accountId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        Long creditScore = user.getCreditScore();

        if (creditScore < 600) {
            throw new IllegalArgumentException("Credit score too low for a loan. Score: " + creditScore);
        }

        long maxLoan;
        if (creditScore >= 750) maxLoan = 500000L;
        else if (creditScore >= 700) maxLoan = 200000L;
        else maxLoan = 50000L;

        if (amount > maxLoan) {
            throw new IllegalArgumentException(
                "Loan amount exceeds limit for your credit score. Max: ₹" + maxLoan
            );
        }

        if (account.getLoanBalance() > 0) {
            syncCreditScore(account, user, creditScore - 15L);  // ✅ both updated
            userRepository.save(user);
            bankRepository.save(account);                       // ✅ persist Bank too
            throw new IllegalArgumentException(
                "Existing loan unpaid. Repay ₹" + account.getLoanBalance() + " first. Credit score reduced."
            );
        }

        account.setBalance(account.getBalance() + amount);
        account.setLoanBalance(amount);
        account.setUpdatedAt(LocalDateTime.now());
        account.setDescription(account.getDescription());

        syncCreditScore(account, user, creditScore - 5L);       // ✅ both updated
        userRepository.save(user);

        Bank updated = bankRepository.save(account);
        return mapToResponse(updated, user);
    }

    @Transactional
    public AccountResponse repay(Long accountId, Long amount) {
        if (amount <= 0) {
            throw new IllegalArgumentException("Repayment amount must be positive");
        }

        Bank account = bankRepository.findById(accountId)
                .orElseThrow(() -> new IllegalArgumentException("Account not found"));

        User user = userRepository.findByAccount_Id(accountId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (account.getLoanBalance() <= 0) {
            throw new IllegalArgumentException("No outstanding loan to repay");
        }

        if (account.getBalance() < amount) {
            Long penalized = Math.max(0L, user.getCreditScore() - 10L);
            syncCreditScore(account, user, penalized);          // ✅ both updated
            userRepository.save(user);
            bankRepository.save(account);                       // ✅ persist Bank too
            throw new IllegalArgumentException(
                "Insufficient balance. Credit score reduced. Score: " + penalized
            );
        }

        account.setBalance(account.getBalance() - amount);
        account.setDescription(account.getDescription());
        long remaining = account.getLoanBalance() - amount;

        if (remaining <= 0) {
            account.setLoanBalance(0L);
            syncCreditScore(account, user, Math.min(850L, user.getCreditScore() + 20L));  // ✅
        } else {
            account.setLoanBalance(remaining);
            syncCreditScore(account, user, Math.min(850L, user.getCreditScore() + 10L));  // ✅
        }

        account.setUpdatedAt(LocalDateTime.now());
        userRepository.save(user);

        Bank updated = bankRepository.save(account);
        return mapToResponse(updated, user);
    }

    private AccountResponse mapToResponse(Bank account, User user) {
        return new AccountResponse(
            account.getId(),
            account.getCustomerName(),
            account.getAccountNumber(),
            account.getBalance(),
            account.getLoanBalance(),
            account.getCreditScore(),   // ✅ Bank and User are always in sync now
            account.getCreatedAt(),
            account.getUpdatedAt(),
            account.getDescription()
        );
    }

    private AccountResponse mapToResponse(Bank account) {
        return new AccountResponse(
            account.getId(),
            account.getCustomerName(),
            account.getAccountNumber(),
            account.getBalance(),
            account.getLoanBalance(),
            account.getCreditScore(),
            account.getCreatedAt(),
            account.getUpdatedAt(),
            account.getDescription()
        );
    }
}