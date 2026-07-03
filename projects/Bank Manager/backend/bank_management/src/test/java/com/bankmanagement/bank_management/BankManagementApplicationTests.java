package com.bankmanagement.bank_management;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import com.bankmanagement.bank_management.database.Bank;
import com.bankmanagement.bank_management.database.User;
import com.bankmanagement.bank_management.dto.AuthRequest;
import com.bankmanagement.bank_management.repository.BankRepository;
import com.bankmanagement.bank_management.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;

import static org.mockito.ArgumentMatchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import jakarta.transaction.Transactional;

@SpringBootTest  
@AutoConfigureMockMvc
@Transactional 
@ActiveProfiles("test")
class BankManagementApplicationTests {

    @Autowired
    MockMvc mockMvc;  // same client as controller tests

    @Autowired
    BankRepository bankRepository;

    @Autowired
    UserRepository userRepository;

    @Autowired
    ObjectMapper objectMapper;

    @Autowired
    PasswordEncoder passwordEncoder;


    @BeforeEach
    void setUp() {
        Bank bank = new Bank();
        bank.setAccountNumber("BC001");
        bank.setCustomerName("John");
        bank.setBalance(1000L);
        bankRepository.save(bank);

        User user = new User(null, "saisakthi", passwordEncoder.encode("saisakthi2008"), 700L, bank);
        userRepository.save(user);
    }

    @Test
    void userAldreadyExists_register_return403() throws Exception {
        AuthRequest request = new AuthRequest();
        request.setUsername("saisakthi");
        request.setPassword("saisakthi2008");

        mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
        .content(objectMapper.writeValueAsString(request)))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.success").value(false))
        .andExpect(jsonPath("$.message").value("Username already exists"));
    }
    @Test
    void newUser_register_return200() throws Exception {
        AuthRequest request = new AuthRequest();
        request.setUsername("sai");
        request.setPassword("sai2008");

        mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
        .content(objectMapper.writeValueAsString(request)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.message").value("Registration successful"));
    }
    @Test
    void nonExistsUser_login_return403() throws Exception {
        AuthRequest request = new AuthRequest();
        request.setUsername("saik");
        request.setPassword("saik2008");

        mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
        .content(objectMapper.writeValueAsString(request)))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.success").value(false))
        .andExpect(jsonPath("$.message").value("Invalid username or password"));
    }
    @Test
    void invalidPassword_login_return403() throws Exception {
        AuthRequest request = new AuthRequest();
        request.setUsername("saisakthi");
        request.setPassword("saik2008");

        mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
        .content(objectMapper.writeValueAsString(request)))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.success").value(false))
        .andExpect(jsonPath("$.message").value("Invalid username or password"));
    }
    @Test
    void correctPassword_login_return200() throws Exception {
        AuthRequest request = new AuthRequest();
        request.setUsername("saisakthi");
        request.setPassword("saisakthi2008");

        mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
        .content(objectMapper.writeValueAsString(request)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.message").value("Login successful"));
    }

}