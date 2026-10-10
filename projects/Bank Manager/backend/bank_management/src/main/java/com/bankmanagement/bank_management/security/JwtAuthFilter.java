package com.bankmanagement.bank_management.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * Reads "Authorization: Bearer <jwt>" and, if the token verifies, authenticates the request.
 * Deliberately NOT a @Component: it is created in SecurityConfig so it only runs inside the security chain.
 */
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;

    public JwtAuthFilter(JwtUtil jwtUtil) {
        this.jwtUtil = jwtUtil;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String header = request.getHeader("Authorization");

        if (header != null && header.startsWith("Bearer ")
                && SecurityContextHolder.getContext().getAuthentication() == null) {
            String token = header.substring(7).trim();
            try {
                // ASSUMPTION: JwtUtil.extractUsername(String) parses the token with signature + expiry
                // verification and throws on a bad token. Rename this call if your method differs.
                String username = jwtUtil.extractUsername(token);
                if (username != null && !username.isBlank()) {
                    SecurityContextHolder.getContext().setAuthentication(
                        new UsernamePasswordAuthenticationToken(username, null, List.of()));
                }
            } catch (RuntimeException e) {
                // invalid, expired or malformed token: stay unauthenticated -> 401 on protected routes
            }
        }

        chain.doFilter(request, response);
    }
}