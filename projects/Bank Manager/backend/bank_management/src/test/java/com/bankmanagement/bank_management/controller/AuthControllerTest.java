package com.bankmanagement.bank_management.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import javax.print.attribute.standard.Media;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;

import com.bankmanagement.bank_management.dto.AccountRequest;
import com.bankmanagement.bank_management.dto.AuthRequest;
import com.bankmanagement.bank_management.dto.AuthResponse;
import com.bankmanagement.bank_management.service.AuthService;
import com.fasterxml.jackson.databind.ObjectMapper;


@WebMvcTest(AuthController.class)
@AutoConfigureMockMvc(addFilters = false)  
public class AuthControllerTest {

    @Autowired
    MockMvc mockMvc;

    @MockitoBean
    AuthService authService;

    @Autowired
    ObjectMapper objectMapper;

    @Test
    void existingAccount_register_return400() throws Exception {
        AuthRequest request = new AuthRequest();
        request.setUsername("sai");
        request.setPassword("sai#2008");
        when(authService.register(any())).thenThrow(new IllegalArgumentException("Account aldready exists"));
        mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).
        content(objectMapper.writeValueAsString(request)))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.success").value(false))
        .andExpect(jsonPath("$.message").value("Account aldready exists"));
    }
    @Test
    void newAccount_register_return200() throws Exception{
        AuthRequest request = new AuthRequest();
        request.setUsername("sai");
        request.setPassword("saisakthi#2008");
        AuthResponse response = new AuthResponse(null, null, null, null, null, 700, 0L);
        response.setUsername("sai");
        when(authService.register(any())).thenReturn(response);
        mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
        .content(objectMapper.writeValueAsString(request)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.message").value("Registration successful"));
        ;
    }
    @Test
    void userdoesnotExists_login_return400() throws Exception {
        AuthRequest request = new AuthRequest();
        request.setUsername("sai");
        request.setPassword("sai#2008");
        when(authService.login(any())).thenThrow(new IllegalArgumentException("User does not exists"));
        mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).
        content(objectMapper.writeValueAsString(request)))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.success").value(false))
        .andExpect(jsonPath("$.message").value("User does not exists"));
    }
    @Test
    void wrongUsernameOrPassword_login_return400() throws Exception {
        AuthRequest request = new AuthRequest();
        request.setUsername("sai");
        request.setPassword("sai#2008");
        AuthResponse response = new AuthResponse(null, null, null, null, null, 700, 0L);
        response.setUsername("sai");
        when(authService.login(any())).thenThrow(new IllegalArgumentException("Invalid username or password"));
        mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).
        content(objectMapper.writeValueAsString(request)))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.success").value(false))
        .andExpect(jsonPath("$.message").value("Invalid username or password"));
    }
    @Test
    void correctuserpassword_login_return200() throws Exception {
        AuthRequest request = new AuthRequest();
        request.setUsername("sai");
        request.setPassword("saisakthi#2008");
        AuthResponse response = new AuthResponse(null, null, null, null, null, 700, 0L);
        response.setUsername("sai");
        when(authService.login(any())).thenReturn(response);
        mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
        .content(objectMapper.writeValueAsString(request)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.message").value("Login successful"));
        ;
    }



    
}