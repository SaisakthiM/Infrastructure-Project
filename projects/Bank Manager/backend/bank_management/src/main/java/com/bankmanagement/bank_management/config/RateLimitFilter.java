package com.bankmanagement.bank_management.config;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.ConsumptionProbe;
import io.github.bucket4j.Refill;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

@Component
public class RateLimitFilter extends OncePerRequestFilter {

    // Safety valve so spoofed/rotating IPs can't grow the map without bound
    private static final int MAX_TRACKED_KEYS = 50_000;

    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();
    private final int authPerMin;
    private final int apiPerMin;

    public RateLimitFilter(
            @Value("${bank.ratelimit.auth-per-min:20}") int authPerMin,    // login + register, per IP
            @Value("${bank.ratelimit.api-per-min:300}") int apiPerMin) {   // every other /api call, per IP
        this.authPerMin = authPerMin;
        this.apiPerMin = apiPerMin;
    }

    private Bucket bucketFor(String key, int perMinute) {
        if (buckets.size() > MAX_TRACKED_KEYS) {
            buckets.clear();
        }
        return buckets.computeIfAbsent(key, k -> Bucket.builder()
                .addLimit(Bandwidth.classic(perMinute, Refill.greedy(perMinute, Duration.ofMinutes(1))))
                .build());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {

        String path = request.getRequestURI();

        // Only /api/** is limited; CORS preflights and internal endpoints (actuator) pass through
        if (!path.startsWith("/api/") || "OPTIONS".equalsIgnoreCase(request.getMethod())) {
            filterChain.doFilter(request, response);
            return;
        }

        boolean authEndpoint = path.startsWith("/api/auth/");
        int limit = authEndpoint ? authPerMin : apiPerMin;
        String key = (authEndpoint ? "auth:" : "api:") + getClientIP(request);

        ConsumptionProbe probe = bucketFor(key, limit).tryConsumeAndReturnRemaining(1);

        if (probe.isConsumed()) {
            response.addHeader("X-RateLimit-Remaining", String.valueOf(probe.getRemainingTokens()));
            filterChain.doFilter(request, response);
        } else {
            long retryAfter = Math.max(1, TimeUnit.NANOSECONDS.toSeconds(probe.getNanosToWaitForRefill()));
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setHeader("Retry-After", String.valueOf(retryAfter));
            response.setContentType("application/json");
            response.getWriter().write(
                "{\"success\":false,\"message\":\"Too many requests. Please try again later.\",\"data\":null}"
            );
        }
    }

    /**
     * The origin is only reachable through the Cloudflare tunnel, which overwrites CF-Connecting-IP,
     * so clients cannot spoof it. (Trusting the first X-Forwarded-For entry alone lets anyone dodge the
     * limit by sending their own header.)
     */
    private String getClientIP(HttpServletRequest request) {
        String cf = request.getHeader("CF-Connecting-IP");
        if (cf != null && !cf.isBlank()) {
            return cf.trim();
        }
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}