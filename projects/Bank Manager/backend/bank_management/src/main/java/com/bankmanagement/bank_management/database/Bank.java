package com.bankmanagement.bank_management.database;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "bank_accounts")
@Builder
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Bank {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false)
    private String customerName;
    
    @Column(nullable = false)
    private Integer creditScore = 700;
    
    @Column(nullable = false)
    private Long balance = 0L;
    
    @Column(unique = true, nullable = false)
    private String accountNumber;

    @Column(nullable = false)
    private Long loanBalance = 0L;
    
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
    
    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @Column(nullable = true)
    private String description;
    
    // Custom method to update balance and timestamp
    public void updateBalance(Long newBalance) {
        this.balance = newBalance;
        this.updatedAt = LocalDateTime.now();
    }
    
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }
    
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}