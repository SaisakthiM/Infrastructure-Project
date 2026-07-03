package com.bankmanagement.bank_management.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class AuthResponse {
    private String token;
    private String username;
    private String accountNumber;
    private Long accountId;
    private Long balance;
    private Integer creditScore;  // ← add
    private Long loanBalance;     // ← add
}