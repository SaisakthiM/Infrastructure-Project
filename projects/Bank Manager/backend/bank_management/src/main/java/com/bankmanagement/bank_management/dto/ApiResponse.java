package com.bankmanagement.bank_management.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ApiResponse {
    private boolean success;
    private String message;
    private Object data;
    
    // Convenience constructor for responses without data
    public ApiResponse(boolean success, String message, AccountResponse account) {
        this.success = success;
        this.message = message;
        this.data = account; 
    }
}