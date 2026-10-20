package com.example.fileHandling.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Who is calling? Ask the city bank.
 * The caller's JWT and account id are replayed against GET {bank}/accounts/{id}; the bank answers 200 only
 * if the token is valid and owns that account, and the answer carries the username (customerName).
 * Verified identities are trusted for 60 s; if the bank is unreachable, one verified within 24 h is accepted
 * so districts keep working in Safe Mode. A 401/403 from the bank always wins.
 */
@Service
public class BankIdentityService {

  private static final long FRESH_MS = 60_000;
  private static final long STALE_MS = 24L * 3600 * 1000;

  private record Entry(long at, String user) {}

  private enum State { OK, DENIED, DOWN }

  private record Lookup(State state, String user) {}

  private final String base;
  private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofMillis(2500)).build();
  private final ObjectMapper mapper = new ObjectMapper();
  private final Map<String, Entry> cache = new ConcurrentHashMap<>();

  public BankIdentityService(@Value("${city.bank.api-url:http://bank-backend:8080/api}") String base) {
    this.base = base.endsWith("/") ? base.substring(0, base.length() - 1) : base;
  }

  /** @return the verified username, or null */
  public String verify(String authorization, String accountId) {
    if (authorization == null || !authorization.startsWith("Bearer ")) return null;
    if (accountId == null || !accountId.matches("\\d{1,18}")) return null;
    String token = authorization.substring(7).trim();
    if (token.isEmpty()) return null;

    String key = accountId + ":" + token;
    long now = System.currentTimeMillis();
    Entry hit = cache.get(key);
    if (hit != null && now - hit.at() < FRESH_MS) return hit.user();

    Lookup result = lookup(accountId, token);
    switch (result.state()) {
      case OK:
        if (cache.size() > 2000) cache.clear();
        cache.put(key, new Entry(now, result.user()));
        return result.user();
      case DENIED:
        cache.remove(key);
        return null;
      default:
        return (hit != null && now - hit.at() < STALE_MS) ? hit.user() : null;
    }
  }

  private Lookup lookup(String accountId, String token) {
    try {
      HttpRequest request =
          HttpRequest.newBuilder(URI.create(base + "/accounts/" + accountId))
              .timeout(Duration.ofMillis(2500))
              .header("Authorization", "Bearer " + token)
              .header("Accept", "application/json")
              .GET()
              .build();
      HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
      int status = response.statusCode();
      if (status == 200) {
        String name = mapper.readTree(response.body()).path("data").path("customerName").asText("");
        return name.isEmpty() ? new Lookup(State.DENIED, null) : new Lookup(State.OK, name);
      }
      if (status == 400 || status == 401 || status == 403 || status == 404) return new Lookup(State.DENIED, null);
      return new Lookup(State.DOWN, null);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      return new Lookup(State.DOWN, null);
    } catch (IOException | RuntimeException e) {
      return new Lookup(State.DOWN, null);
    }
  }
}
