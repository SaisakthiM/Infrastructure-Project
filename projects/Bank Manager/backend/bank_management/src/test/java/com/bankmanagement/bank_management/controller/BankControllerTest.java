package com.bankmanagement.bank_management.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.bankmanagement.bank_management.dto.AccountRequest;
import com.bankmanagement.bank_management.dto.AccountResponse;
import com.bankmanagement.bank_management.dto.TransactionRequest;
import com.bankmanagement.bank_management.service.BankService;
import com.fasterxml.jackson.databind.ObjectMapper;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import org.springframework.http.MediaType;

@WebMvcTest(BankController.class)
@AutoConfigureMockMvc(addFilters = false)
public class BankControllerTest {

    @Autowired
    MockMvc mockMvc;

    @MockitoBean
    BankService bankService;

    @Autowired
    ObjectMapper objectMapper;

    @Test
    void existingAccount_createAccount_return400() throws Exception {
        AccountRequest request = new AccountRequest();
        request.setAccountNumber("BC001");

        when(bankService.createAccount(any())).thenThrow(new IllegalArgumentException("Account number already exists"));

        mockMvc.perform(post("/api/accounts").contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
              
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Account number already exists"));
    }
    @Test
    void newAccount_createAccount_return200() throws Exception {
        AccountResponse response = new AccountResponse();
        response.setAccountNumber("BC001");

        AccountRequest request = new AccountRequest();
        request.setAccountNumber("BC001");

        when(bankService.createAccount(any())).thenReturn(response);

        mockMvc.perform(post("/api/accounts").contentType(MediaType.APPLICATION_JSON)
        .content(objectMapper.writeValueAsString(request)))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.success").value(true))
        .andExpect(jsonPath("$.message").value("Account created successfully"));
    }
    @Test
    void nonExistAccount_getAccount_return404() throws Exception {
        when(bankService.getAccountById(any()))
            .thenThrow(new IllegalArgumentException("Account Does not exists"));

        mockMvc.perform(get("/api/accounts/1"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.message").value("Account Does not exists"));
    }

    @Test
    void existsAccount_getAccount_return200() throws Exception {
        AccountResponse response = new AccountResponse();
        response.setAccountNumber("BC001");
        response.setId(1L);

        when(bankService.getAccountById(1L)).thenReturn(response);

        mockMvc.perform(get("/api/accounts/1"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    void nonExistsAccountDeposit_deposit_return400() throws Exception {
        AccountRequest request = new AccountRequest();
        request.setAccountNumber("BC001");
        
        when(bankService.deposit(anyLong(), any())).thenThrow(new IllegalArgumentException("Account does not exists"));
        mockMvc.perform(post("/api/accounts/1/deposit").contentType(MediaType.APPLICATION_JSON)
        .content(objectMapper.writeValueAsString(request)))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.success").value(false))
        .andExpect(jsonPath("$.message").value("Account does not exists"));
    }

    @Test
    void existsAccount_deposit_return200() throws Exception {
        AccountResponse response = new AccountResponse();
        response.setAccountNumber("BC001");
        response.setId(1L);

        TransactionRequest request = new TransactionRequest();
        request.setAmount(100L);

        when(bankService.deposit(anyLong(), any())).thenReturn(response);

        mockMvc.perform(post("/api/accounts/1/deposit")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.message").value("Deposit successful"));
    }

    @Test
    void ExistsAccountNegativeDeposit_deposit_return400() throws Exception {

        TransactionRequest request = new TransactionRequest();
        request.setAmount(-1L);

        when(bankService.deposit(anyLong(), any()))
    .thenThrow(new IllegalArgumentException("Deposit amount must be positive"));
        
        mockMvc.perform(post("/api/accounts/1/deposit").contentType(MediaType.APPLICATION_JSON)
        .content(objectMapper.writeValueAsString(request)))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.success").value(false))
        .andExpect(jsonPath("$.message").value("Deposit amount must be positive"));
    }

    @Test
    void negativeWithdraw_withdraw_return400() throws Exception {
        TransactionRequest request = new TransactionRequest();
        request.setAmount(-100L);

        when(bankService.withdraw(anyLong(), any()))
            .thenThrow(new IllegalArgumentException("Withdrawal amount must be positive"));

        mockMvc.perform(post("/api/accounts/1/withdraw")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.message").value("Withdrawal amount must be positive"));
    }

    @Test
    void insufficientBalance_withdraw_return400() throws Exception {
        TransactionRequest request = new TransactionRequest();
        request.setAmount(99999L);

        when(bankService.withdraw(anyLong(), any()))
            .thenThrow(new IllegalArgumentException("Insufficient balance. Current balance: 0"));

        mockMvc.perform(post("/api/accounts/1/withdraw")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.message").value("Insufficient balance. Current balance: 0"));
    }

    @Test
    void validWithdraw_withdraw_return200() throws Exception {
        TransactionRequest request = new TransactionRequest();
        request.setAmount(100L);

        AccountResponse response = new AccountResponse();
        response.setId(1L);
        response.setAccountNumber("BC001");
        response.setBalance(900L);

        when(bankService.withdraw(anyLong(), any())).thenReturn(response);

        mockMvc.perform(post("/api/accounts/1/withdraw")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true));
    }

}