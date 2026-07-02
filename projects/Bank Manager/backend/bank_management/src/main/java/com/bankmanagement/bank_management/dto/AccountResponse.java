package com.bankmanagement.bank_management.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AccountResponse {
    private Long id;
    private String customerName;
    private String accountNumber;
    private Long balance;
    private Long loanBalance;
    private Integer creditScore;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private String description;
}