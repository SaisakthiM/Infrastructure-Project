package com.bankmanagement.bank_management.dto;

import lombok.Data;

@Data
public class AuthRequest {
    private String username;
    private String password;
}
