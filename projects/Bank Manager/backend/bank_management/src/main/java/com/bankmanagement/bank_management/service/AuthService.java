package com.bankmanagement.bank_management.service;

import com.bankmanagement.bank_management.database.Bank;
import com.bankmanagement.bank_management.database.User;
import com.bankmanagement.bank_management.dto.AuthRequest;
import com.bankmanagement.bank_management.dto.AuthResponse;
import com.bankmanagement.bank_management.repository.BankRepository;
import com.bankmanagement.bank_management.repository.UserRepository;
import com.bankmanagement.bank_management.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Random;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final BankRepository bankRepository;
    private final JwtUtil jwtUtil;
    private final PasswordEncoder passwordEncoder;

    public AuthResponse register(AuthRequest request) {
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new IllegalArgumentException("Username already exists");
        }

        // Generate unique account number
        String accountNumber = generateAccountNumber();

        // Create bank account
        Bank account = new Bank();
        account.setCustomerName(request.getUsername());
        account.setAccountNumber(accountNumber);
        account.setBalance(0L);
        account.setCreditScore(700);
        Bank savedAccount = bankRepository.save(account);

        // Create user
        User user = new User();
        user.setUsername(request.getUsername());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setAccount(savedAccount);
        userRepository.save(user);

        String token = jwtUtil.generateToken(request.getUsername());
        return new AuthResponse(token, request.getUsername(), accountNumber, 
    savedAccount.getId(), 0L, 700, 0L);
    }

    public AuthResponse login(AuthRequest request) {
        User user = userRepository.findByUsername(request.getUsername())
                .orElseThrow(() -> new IllegalArgumentException("Invalid username or password"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new IllegalArgumentException("Invalid username or password");
        }

        Bank account = user.getAccount();
        String token = jwtUtil.generateToken(request.getUsername());
        return new AuthResponse(token, user.getUsername(),
    account.getAccountNumber(), account.getId(), 
    account.getBalance(), account.getCreditScore(), account.getLoanBalance());
    }

    private String generateAccountNumber() {
        Random random = new Random();
        String accountNumber;
        do {
            accountNumber = "ACC" + String.format("%09d", random.nextInt(1000000000));
        } while (bankRepository.existsByAccountNumber(accountNumber));
        return accountNumber;
    }
}
