package com.bankmanagement.bank_management.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.bankmanagement.bank_management.database.Bank;
import com.bankmanagement.bank_management.database.User;
import com.bankmanagement.bank_management.dto.AuthRequest;
import com.bankmanagement.bank_management.dto.AuthResponse;
import com.bankmanagement.bank_management.repository.BankRepository;
import com.bankmanagement.bank_management.repository.UserRepository;
import com.bankmanagement.bank_management.security.JwtUtil;

@ExtendWith(MockitoExtension.class)
public class AuthServiceTest {

    @Mock
    UserRepository userRepository;

    @Mock
    BankRepository bankRepository;

    @Mock
    JwtUtil jwtUtil;

    @Mock
    PasswordEncoder passwordEncoder;

    @InjectMocks
    AuthService authService;

    @Test
    void existingUsername_register_shouldThrow() {
        AuthRequest request = new AuthRequest();
        request.setUsername("BC001");
        request.setPassword("2121212");

        when(userRepository.existsByUsername("BC001")).thenReturn(true);

        assertThrows(IllegalArgumentException.class, () -> {
            authService.register(request);
        });
    }

    @Test
    void newUser_register_success() {
        AuthRequest request = new AuthRequest();
        request.setUsername("BC001");
        request.setPassword("2121212");

        Bank savedBank = new Bank();
        savedBank.setId(1L);
        savedBank.setAccountNumber("ACC000000001");
        savedBank.setCustomerName("BC001");
        savedBank.setBalance(0L);

        when(userRepository.existsByUsername("BC001")).thenReturn(false);
        when(bankRepository.existsByAccountNumber(any())).thenReturn(false); // for generateAccountNumber()
        when(bankRepository.save(any())).thenReturn(savedBank);
        when(passwordEncoder.encode(any())).thenReturn("encodedPassword");
        when(jwtUtil.generateToken(any())).thenReturn("token123");

        AuthResponse response = authService.register(request);

        assertEquals("BC001", response.getUsername());
    }

    @Test
    void userNotExists_login_shouldThrow() {
        AuthRequest request = new AuthRequest();
        request.setUsername("BC001");
        request.setPassword("2121212");

        // login() calls findByUsername — not existsByUsername
        when(userRepository.findByUsername("BC001")).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> {
            authService.login(request);
        });
    }

    @Test
    void userExistsPasswordWrong_login_shouldThrow() {
        User user = new User();
        user.setId(1L);
        user.setUsername("BC001");
        user.setPassword("encodedPassword");

        when(userRepository.findByUsername("BC001")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrongPassword", "encodedPassword")).thenReturn(false);

        AuthRequest request = new AuthRequest();
        request.setUsername("BC001");
        request.setPassword("wrongPassword");

        assertThrows(IllegalArgumentException.class, () -> {
            authService.login(request);
        });
    }

    @Test
    void userExistsPasswordCorrect_login_success() {
        Bank account = new Bank();
        account.setId(1L);
        account.setAccountNumber("ACC000000001");
        account.setBalance(1000L);

        User user = new User();
        user.setId(1L);
        user.setUsername("BC001");
        user.setPassword("encodedPassword");
        user.setAccount(account);

        when(userRepository.findByUsername("BC001")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("2121212", "encodedPassword")).thenReturn(true);
        when(jwtUtil.generateToken("BC001")).thenReturn("token123");

        AuthRequest request = new AuthRequest();
        request.setUsername("BC001");
        request.setPassword("2121212");

        AuthResponse response = authService.login(request);

        assertEquals("BC001", response.getUsername());
        assertEquals("ACC000000001", response.getAccountNumber());
        assertEquals(1000L, response.getBalance());
    }
}