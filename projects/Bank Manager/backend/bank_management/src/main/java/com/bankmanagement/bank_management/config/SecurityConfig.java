package com.bankmanagement.bank_management.config;

import com.bankmanagement.bank_management.security.JwtAuthFilter;
import com.bankmanagement.bank_management.security.JwtUtil;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final RateLimitFilter rateLimitFilter;
    private final JwtUtil jwtUtil;
    private final boolean enforce;

    public SecurityConfig(RateLimitFilter rateLimitFilter,
                          JwtUtil jwtUtil,
                          @Value("${bank.auth.enforce:true}") boolean enforce) {
        this.rateLimitFilter = rateLimitFilter;
        this.jwtUtil = jwtUtil;
        this.enforce = enforce;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .cors(Customizer.withDefaults())
            .csrf(csrf -> csrf.disable())  // stateless REST API with bearer tokens
            .sessionManagement(session -> session
                .sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            // missing/invalid token -> 401 (an authenticated but forbidden caller still gets 403)
            .exceptionHandling(e -> e.authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
            .addFilterBefore(rateLimitFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterBefore(new JwtAuthFilter(jwtUtil), UsernamePasswordAuthenticationFilter.class);

        if (enforce) {
            http.authorizeHttpRequests(auth -> auth
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                .requestMatchers("/api/auth/**", "/actuator/**").permitAll()
                // list-all and free-standing account creation can't be scoped to one user
                .requestMatchers(HttpMethod.GET, "/api/accounts").denyAll()
                .requestMatchers(HttpMethod.POST, "/api/accounts").denyAll()
                .anyRequest().authenticated());
        } else {
            // BANK_AUTH_ENFORCE=false keeps the old open behaviour (temporary, for rollout only)
            http.authorizeHttpRequests(auth -> auth.anyRequest().permitAll());
        }

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}