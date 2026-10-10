package com.bankmanagement.bank_management.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    // The UI and API share one origin behind nginx, so CORS only matters for local dev.
    // Override with BANK_CORS_ORIGINS="https://a.example,https://b.example"
    @Value("${bank.cors.origins:https://saisakthi.qzz.io,http://localhost:5173,http://localhost:3000}")
    private String[] origins;

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOrigins(origins)
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH")
                .allowedHeaders("Authorization", "Content-Type")
                .allowCredentials(false)  // bearer tokens, no cookies
                .maxAge(3600);
    }
}