package com.bankmanagement.bank_management.controller;

import com.bankmanagement.bank_management.dto.AccountRequest;
import com.bankmanagement.bank_management.dto.AccountResponse;
import com.bankmanagement.bank_management.dto.ApiResponse;
import com.bankmanagement.bank_management.dto.TransactionRequest;
import com.bankmanagement.bank_management.security.AccountGuard;
import com.bankmanagement.bank_management.service.BankService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/accounts")
@RequiredArgsConstructor
public class BankController {

    private final BankService bankService;
    private final AccountGuard accountGuard;

    private static boolean badAmount(TransactionRequest request) {
        return request == null || request.getAmount() == null || request.getAmount() <= 0;
    }

    private static ResponseEntity<ApiResponse> amountError() {
        return ResponseEntity.badRequest()
                .body(new ApiResponse(false, "Amount must be a positive number", null));
    }

    // Create new account (blocked for everyone in SecurityConfig while enforcement is on:
    // registration already creates the user's account)
    @PostMapping
    public ResponseEntity<ApiResponse> createAccount(@RequestBody AccountRequest request) {
        try {
            AccountResponse account = bankService.createAccount(request);
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(new ApiResponse(true, "Account created successfully", account));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(new ApiResponse(false, e.getMessage(), null));
        }
    }

    // Get account by ID (own account only)
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse> getAccount(@PathVariable Long id, Authentication authentication) {
        accountGuard.requireOwner(authentication, id);
        try {
            AccountResponse account = bankService.getAccountById(id);
            return ResponseEntity.ok(new ApiResponse(true, "Account found", account));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ApiResponse(false, e.getMessage(), null));
        }
    }

    // Get all accounts (blocked for everyone in SecurityConfig while enforcement is on)
    @GetMapping
    public ResponseEntity<ApiResponse> getAllAccounts() {
        List<AccountResponse> accounts = bankService.getAllAccounts();
        return ResponseEntity.ok(new ApiResponse(true, "Accounts retrieved", accounts));
    }

    // Deposit money
    @PostMapping("/{id}/deposit")
    public ResponseEntity<ApiResponse> deposit(
            @PathVariable Long id,
            @RequestBody TransactionRequest request,
            Authentication authentication) {
        accountGuard.requireOwner(authentication, id);
        if (badAmount(request)) return amountError();
        try {
            AccountResponse account = bankService.deposit(id, request.getAmount());
            return ResponseEntity.ok(new ApiResponse(true, "Deposit successful", account));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(new ApiResponse(false, e.getMessage(), null));
        }
    }

    // Withdraw money
    @PostMapping("/{id}/withdraw")
    public ResponseEntity<ApiResponse> withdraw(
            @PathVariable Long id,
            @RequestBody TransactionRequest request,
            Authentication authentication) {
        accountGuard.requireOwner(authentication, id);
        if (badAmount(request)) return amountError();
        try {
            AccountResponse account = bankService.withdraw(id, request.getAmount());
            return ResponseEntity.ok(new ApiResponse(true, "Withdrawal successful", account));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(new ApiResponse(false, e.getMessage(), null));
        }
    }

    @PostMapping("/{id}/loan")
    public ResponseEntity<ApiResponse> loan(
            @PathVariable Long id,
            @RequestBody TransactionRequest request,
            Authentication authentication) {
        accountGuard.requireOwner(authentication, id);
        if (badAmount(request)) return amountError();
        try {
            AccountResponse account = bankService.loan(id, request.getAmount());
            return ResponseEntity.ok(new ApiResponse(true, "Loan successful, Added into your balance", account));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(new ApiResponse(false, e.getMessage(), null));
        }
    }

    @PostMapping("/{id}/repay")
    public ResponseEntity<ApiResponse> repay(
            @PathVariable Long id,
            @RequestBody TransactionRequest request,
            Authentication authentication) {
        accountGuard.requireOwner(authentication, id);
        if (badAmount(request)) return amountError();
        try {
            AccountResponse account = bankService.repay(id, request.getAmount());
            return ResponseEntity.ok(new ApiResponse(true, "Repay successful, Reduced from your balance", account));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(new ApiResponse(false, e.getMessage(), null));
        }
    }
}