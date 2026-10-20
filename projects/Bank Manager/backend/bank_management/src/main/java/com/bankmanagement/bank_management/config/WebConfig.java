package com.bankmanagement.bank_management.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    // The UI and API normally share one origin behind nginx, so CORS only matters when a page on another origin
    // calls the bank directly: `vite dev`, the docker-compose port (localhost:8080) or a page opened from localhost.
    //
    // This is the list of allowed origins. localhost / 127.0.0.1 / [::1] are allowed on every port (and on the
    // default port 80/443) so the bank works locally with no extra setup.
    // Override (comma separated, `*` wildcards allowed):  BANK_CORS_ORIGINS="https://a.example,http://localhost:*"
    @Value("${bank.cors.origins:https://saisakthi.qzz.io,http://localhost,https://localhost,http://localhost:*,https://localhost:*,http://127.0.0.1,http://127.0.0.1:*,http://[::1],http://[::1]:*}")
    private String[] origins;

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOriginPatterns(origins)   // patterns (not allowedOrigins) so "localhost:*" works for any port
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH")
                .allowedHeaders("Authorization", "Content-Type")
                .allowCredentials(false)  // bearer tokens, no cookies
                .maxAge(3600);
    }
}
