package com.bankmanagement.bank_management.security;

import com.bankmanagement.bank_management.database.User;
import com.bankmanagement.bank_management.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

/** Ownership rule: a caller may only touch the account linked to their own user. */
@Component
public class AccountGuard {

    private final UserRepository userRepository;
    private final boolean enforce;

    public AccountGuard(UserRepository userRepository,
                        @Value("${bank.auth.enforce:true}") boolean enforce) {
        this.userRepository = userRepository;
        this.enforce = enforce;
    }

    public void requireOwner(Authentication authentication, Long accountId) {
        if (!enforce) {
            return;
        }
        if (authentication == null
                || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken) {
            throw new AccessDeniedException("Not authenticated");
        }
        boolean owns = userRepository.findByUsername(authentication.getName())
                .map(User::getAccount)
                .map(account -> account.getId().equals(accountId))
                .orElse(false);
        if (!owns) {
            throw new AccessDeniedException("You can only access your own account");
        }
    }
}