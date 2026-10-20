package com.example.bank.config; // <- change to your bank's base package

import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

/**
 * Lets pages served from localhost (docker-compose gateway on :80, `vite dev` on :5173, …) call the bank.
 *
 * - Origins come from CITY_CORS_ORIGINS (comma separated, wildcards allowed: http://localhost:*). The compose overlay
 *   sets a sensible default; production keeps its own domain list, so nothing here changes your deployed behaviour
 *   unless you set the variable there too.
 * - Registered as a servlet filter with the highest precedence, so it also answers the browser's OPTIONS pre-flight
 *   before Spring Security can reject it — it works whether or not the bank uses Spring Security.
 * - The city sends a Bearer token in the Authorization header, never cookies, so credentials stay off.
 *
 * If your bank ALREADY has a CORS config (WebMvcConfigurer#addCorsMappings, @CrossOrigin, a CorsConfigurationSource bean),
 * delete this file and just add the localhost origins to that list instead — two competing configs are confusing.
 */
@Configuration
public class CityLocalHosts {

    @Bean
    public FilterRegistrationBean<CorsFilter> cityCorsFilter(
            @Value("${CITY_CORS_ORIGINS:http://localhost,http://127.0.0.1,http://localhost:*,http://127.0.0.1:*}") String[] origins) {
        CorsConfiguration cfg = new CorsConfiguration();
        cfg.setAllowedOriginPatterns(List.of(origins));
        cfg.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        cfg.setAllowedHeaders(List.of("*"));
        cfg.setAllowCredentials(false);
        cfg.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", cfg);

        FilterRegistrationBean<CorsFilter> bean = new FilterRegistrationBean<>(new CorsFilter(source));
        bean.setOrder(Ordered.HIGHEST_PRECEDENCE);
        return bean;
    }
}
