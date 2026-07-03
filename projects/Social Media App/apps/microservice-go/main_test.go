package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
)

// ── Test setup ────────────────────────────────────────────────────────────────

// newTestRedis spins up an in-process fake Redis (miniredis) and wires the
// global `rdb` used by all handlers.  Returns a cleanup func.
func newTestRedis(t *testing.T) *miniredis.Miniredis {
	t.Helper()
	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("could not start miniredis: %v", err)
	}
	rdb = redis.NewClient(&redis.Options{Addr: mr.Addr()})
	ctx = context.Background()
	t.Cleanup(func() {
		rdb.Close()
		mr.Close()
	})
	return mr
}

// post is a helper that builds a POST request with a JSON body.
func post(path string, body any) *http.Request {
	b, _ := json.Marshal(body)
	r := httptest.NewRequest(http.MethodPost, path, bytes.NewReader(b))
	r.Header.Set("Content-Type", "application/json")
	return r
}

// decode unmarshals a response body into a map for assertions.
func decode(t *testing.T, w *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	var m map[string]any
	if err := json.NewDecoder(w.Body).Decode(&m); err != nil {
		t.Fatalf("failed to decode response: %v\nbody: %s", err, w.Body.String())
	}
	return m
}

// ── Health ────────────────────────────────────────────────────────────────────

func TestHealthHandler_Healthy(t *testing.T) {
	newTestRedis(t)

	w := httptest.NewRecorder()
	healthHandler(w, httptest.NewRequest(http.MethodGet, "/health", nil))

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	body := decode(t, w)
	if body["status"] != "healthy" {
		t.Errorf("expected status=healthy, got %v", body["status"])
	}
}

func TestHealthHandler_RedisDown(t *testing.T) {
	mr := newTestRedis(t)
	mr.Close() // kill Redis before the request

	w := httptest.NewRecorder()
	healthHandler(w, httptest.NewRequest(http.MethodGet, "/health", nil))

	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", w.Code)
	}
}

// ── Rate limiting ─────────────────────────────────────────────────────────────

func TestRateLimitHandler_MethodNotAllowed(t *testing.T) {
	newTestRedis(t)

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/api/go/rate-limit/check", nil)
	rateLimitHandler(w, r)

	if w.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405, got %d", w.Code)
	}
}

func TestRateLimitHandler_InvalidBody(t *testing.T) {
	newTestRedis(t)

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodPost, "/api/go/rate-limit/check",
		bytes.NewBufferString("not-json"))
	rateLimitHandler(w, r)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestRateLimitHandler_Allowed(t *testing.T) {
	newTestRedis(t)

	w := httptest.NewRecorder()
	rateLimitHandler(w, post("/api/go/rate-limit/check", map[string]any{
		"user_id":        "u1",
		"action":         "post_create",
		"limit":          10,
		"window_seconds": 3600,
	}))

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	body := decode(t, w)
	if body["allowed"] != true {
		t.Errorf("first request should be allowed")
	}
	if body["current"] != float64(1) {
		t.Errorf("current should be 1, got %v", body["current"])
	}
}

func TestRateLimitHandler_ExceedsLimit(t *testing.T) {
	newTestRedis(t)

	payload := map[string]any{
		"user_id":        "u2",
		"action":         "post_create",
		"limit":          2,
		"window_seconds": 3600,
	}

	// exhaust the limit
	for i := 0; i < 2; i++ {
		w := httptest.NewRecorder()
		rateLimitHandler(w, post("/api/go/rate-limit/check", payload))
		if w.Code != http.StatusOK {
			t.Fatalf("request %d: expected 200, got %d", i+1, w.Code)
		}
	}

	// third request should be denied
	w := httptest.NewRecorder()
	rateLimitHandler(w, post("/api/go/rate-limit/check", payload))
	body := decode(t, w)
	if body["allowed"] != false {
		t.Errorf("third request should be denied; body: %v", body)
	}
}

// ── Presence ──────────────────────────────────────────────────────────────────

func TestPresenceHeartbeat_MethodNotAllowed(t *testing.T) {
	newTestRedis(t)

	w := httptest.NewRecorder()
	presenceHeartbeatHandler(w, httptest.NewRequest(http.MethodGet, "/", nil))

	if w.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405, got %d", w.Code)
	}
}

func TestPresenceHeartbeatAndGet(t *testing.T) {
	newTestRedis(t)

	// send heartbeat
	w := httptest.NewRecorder()
	presenceHeartbeatHandler(w, post("/api/go/presence/heartbeat", map[string]string{
		"user_id": "u42",
	}))
	if w.Code != http.StatusOK {
		t.Fatalf("heartbeat: expected 200, got %d", w.Code)
	}

	// check presence via GET handler
	w = httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/api/go/presence/u42", nil)
	r.SetPathValue("user_id", "u42")
	presenceGetHandler(w, r)

	body := decode(t, w)
	if body["online"] != true {
		t.Errorf("user should be online after heartbeat; body: %v", body)
	}
}

func TestPresenceGet_MissingUserID(t *testing.T) {
	newTestRedis(t)

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/api/go/presence/", nil)
	r.SetPathValue("user_id", "")
	presenceGetHandler(w, r)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestPresenceGet_Offline(t *testing.T) {
	newTestRedis(t)

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/api/go/presence/unknown", nil)
	r.SetPathValue("user_id", "unknown")
	presenceGetHandler(w, r)

	body := decode(t, w)
	if body["online"] != false {
		t.Errorf("unknown user should be offline; body: %v", body)
	}
}

func TestPresenceBulk(t *testing.T) {
	newTestRedis(t)

	// put u1 online
	presenceHeartbeatHandler(httptest.NewRecorder(),
		post("/", map[string]string{"user_id": "u1"}))

	w := httptest.NewRecorder()
	presenceBulkHandler(w, post("/api/go/presence/bulk", map[string]any{
		"user_ids": []string{"u1", "u2", "u3"},
	}))

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	body := decode(t, w)
	presence := body["presence"].(map[string]any)
	if presence["u1"] != true {
		t.Errorf("u1 should be online")
	}
	if presence["u2"] != false {
		t.Errorf("u2 should be offline")
	}
}

// ── Feed cache ────────────────────────────────────────────────────────────────

func TestFeedCache_SetAndGet(t *testing.T) {
	newTestRedis(t)

	feedJSON := `[{"post_id":"p1"},{"post_id":"p2"}]`

	// set
	w := httptest.NewRecorder()
	cacheFeedSetHandler(w, post("/api/go/cache/feed", map[string]any{
		"user_id":     "u10",
		"feed_json":   feedJSON,
		"ttl_seconds": 300,
	}))
	if w.Code != http.StatusOK {
		t.Fatalf("set: expected 200, got %d", w.Code)
	}

	// get
	w = httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/api/go/cache/feed/u10", nil)
	r.SetPathValue("user_id", "u10")
	cacheFeedGetHandler(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("get: expected 200, got %d", w.Code)
	}
	if w.Body.String() != feedJSON {
		t.Errorf("body mismatch:\n  got  %s\n  want %s", w.Body.String(), feedJSON)
	}
}

func TestFeedCache_Miss(t *testing.T) {
	newTestRedis(t)

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/api/go/cache/feed/nobody", nil)
	r.SetPathValue("user_id", "nobody")
	cacheFeedGetHandler(w, r)

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404 on cache miss, got %d", w.Code)
	}
}

func TestFeedCache_Invalidate(t *testing.T) {
	newTestRedis(t)

	// seed a cache entry
	cacheFeedSetHandler(httptest.NewRecorder(), post("/", map[string]any{
		"user_id":     "u11",
		"feed_json":   `[]`,
		"ttl_seconds": 300,
	}))

	// invalidate
	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodDelete, "/api/go/cache/feed/u11", nil)
	r.SetPathValue("user_id", "u11")
	cacheFeedInvalidateHandler(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	// key should be gone
	w = httptest.NewRecorder()
	r = httptest.NewRequest(http.MethodGet, "/api/go/cache/feed/u11", nil)
	r.SetPathValue("user_id", "u11")
	cacheFeedGetHandler(w, r)

	if w.Code != http.StatusNotFound {
		t.Fatalf("after invalidation expected 404, got %d", w.Code)
	}
}

func TestFeedCache_DefaultTTL(t *testing.T) {
	mr := newTestRedis(t)

	cacheFeedSetHandler(httptest.NewRecorder(), post("/", map[string]any{
		"user_id":     "u12",
		"feed_json":   `[]`,
		"ttl_seconds": 0, // should default to 5 min
	}))

	ttl := mr.TTL("feed_cache:u12")
	if ttl < 4*time.Minute || ttl > 6*time.Minute {
		t.Errorf("expected default TTL ~5 min, got %v", ttl)
	}
}

// ── Typing indicators ─────────────────────────────────────────────────────────

func TestTyping_SetAndGet(t *testing.T) {
	newTestRedis(t)

	w := httptest.NewRecorder()
	typingHandler(w, post("/api/go/typing", map[string]string{
		"conversation_id": "c1",
		"user_id":         "u5",
	}))
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	w = httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/api/go/typing/c1", nil)
	r.SetPathValue("conversation_id", "c1")
	typingGetHandler(w, r)

	body := decode(t, w)
	typing, _ := body["typing"].([]any)
	if len(typing) == 0 {
		t.Errorf("expected u5 in typing list; body: %v", body)
	}
}

func TestTyping_MethodNotAllowed(t *testing.T) {
	newTestRedis(t)

	w := httptest.NewRecorder()
	typingHandler(w, httptest.NewRequest(http.MethodGet, "/api/go/typing", nil))

	if w.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405, got %d", w.Code)
	}
}

func TestTyping_EmptyConversation(t *testing.T) {
	newTestRedis(t)

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/api/go/typing/empty", nil)
	r.SetPathValue("conversation_id", "empty")
	typingGetHandler(w, r)

	body := decode(t, w)
	typing := body["typing"].([]any)
	if len(typing) != 0 {
		t.Errorf("expected empty typing list for unknown conversation")
	}
}

// ── Unread counts ─────────────────────────────────────────────────────────────

func TestUnread_IncrementAndTotal(t *testing.T) {
	newTestRedis(t)

	payload := map[string]string{"user_id": "u20", "conversation_id": "c5"}

	// increment twice
	for i := 0; i < 2; i++ {
		w := httptest.NewRecorder()
		unreadIncrementHandler(w, post("/api/go/unread/increment", payload))
		if w.Code != http.StatusOK {
			t.Fatalf("increment %d: expected 200, got %d", i+1, w.Code)
		}
	}

	// check total
	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/api/go/unread/u20", nil)
	r.SetPathValue("user_id", "u20")
	unreadTotalHandler(w, r)

	body := decode(t, w)
	if body["unread_count"] != float64(2) {
		t.Errorf("expected unread_count=2, got %v", body["unread_count"])
	}
}

func TestUnread_Clear(t *testing.T) {
	newTestRedis(t)

	// seed 3 unreads
	for i := 0; i < 3; i++ {
		unreadIncrementHandler(httptest.NewRecorder(), post("/", map[string]string{
			"user_id": "u21", "conversation_id": "c6",
		}))
	}

	// clear them
	w := httptest.NewRecorder()
	unreadClearHandler(w, post("/api/go/unread/clear", map[string]string{
		"user_id": "u21", "conversation_id": "c6",
	}))
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	// total should be 0
	w = httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/api/go/unread/u21", nil)
	r.SetPathValue("user_id", "u21")
	unreadTotalHandler(w, r)

	body := decode(t, w)
	if body["unread_count"] != float64(0) {
		t.Errorf("expected unread_count=0 after clear, got %v", body["unread_count"])
	}
}

func TestUnread_TotalAcrossConversations(t *testing.T) {
	newTestRedis(t)

	for _, conv := range []string{"c10", "c11", "c12"} {
		unreadIncrementHandler(httptest.NewRecorder(), post("/", map[string]string{
			"user_id": "u30", "conversation_id": conv,
		}))
	}

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/api/go/unread/u30", nil)
	r.SetPathValue("user_id", "u30")
	unreadTotalHandler(w, r)

	body := decode(t, w)
	if body["unread_count"] != float64(3) {
		t.Errorf("expected 3 total unreads across 3 conversations, got %v", body["unread_count"])
	}
}

func TestUnread_ZeroForNewUser(t *testing.T) {
	newTestRedis(t)

	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/api/go/unread/newuser", nil)
	r.SetPathValue("user_id", "newuser")
	unreadTotalHandler(w, r)

	body := decode(t, w)
	if body["unread_count"] != float64(0) {
		t.Errorf("expected 0 for new user, got %v", body["unread_count"])
	}
}

// ── Response helpers ──────────────────────────────────────────────────────────

func TestJsonOK_SetsContentType(t *testing.T) {
	w := httptest.NewRecorder()
	jsonOK(w, map[string]string{"hello": "world"})

	ct := w.Header().Get("Content-Type")
	if ct != "application/json" {
		t.Errorf("expected Content-Type application/json, got %s", ct)
	}
	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestJsonErr_SetsStatusAndContentType(t *testing.T) {
	w := httptest.NewRecorder()
	jsonErr(w, "something broke", http.StatusTeapot)

	if w.Code != http.StatusTeapot {
		t.Errorf("expected 418, got %d", w.Code)
	}
	ct := w.Header().Get("Content-Type")
	if ct != "application/json" {
		t.Errorf("expected Content-Type application/json, got %s", ct)
	}
	body := map[string]string{}
	json.NewDecoder(w.Body).Decode(&body)
	if body["error"] != "something broke" {
		t.Errorf("unexpected error body: %v", body)
	}
}

// ── Redis key isolation smoke test ────────────────────────────────────────────

// Verifies that different users never share the same rate-limit bucket.
func TestRateLimit_KeyIsolation(t *testing.T) {
	newTestRedis(t)

	payload := func(uid string) map[string]any {
		return map[string]any{
			"user_id": uid, "action": "post_create", "limit": 1, "window_seconds": 3600,
		}
	}

	// hit limit for u_a
	rateLimitHandler(httptest.NewRecorder(), post("/", payload("u_a")))
	rateLimitHandler(httptest.NewRecorder(), post("/", payload("u_a")))

	// u_b should still be allowed
	w := httptest.NewRecorder()
	rateLimitHandler(w, post("/", payload("u_b")))
	body := decode(t, w)
	if body["allowed"] != true {
		t.Errorf("u_b should not be affected by u_a's limit; body: %v", body)
	}
}

// Verifies that typed key format for presence doesn't collide with unread keys.
func TestKeyNamespaceNoCollision(t *testing.T) {
	newTestRedis(t)

	// Presence heartbeat for "123"
	presenceHeartbeatHandler(httptest.NewRecorder(),
		post("/", map[string]string{"user_id": "123"}))

	// Unread total for "123" — should be 0, not contaminated by presence key
	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodGet, "/api/go/unread/123", nil)
	r.SetPathValue("user_id", "123")
	unreadTotalHandler(w, r)

	body := decode(t, w)
	if body["unread_count"] != float64(0) {
		t.Errorf("namespace collision: unread_count should be 0, got %v (presence key leaked?)", body["unread_count"])
	}
}

// ── Benchmark ─────────────────────────────────────────────────────────────────

func BenchmarkRateLimitHandler(b *testing.B) {
	mr, _ := miniredis.Run()
	defer mr.Close()
	rdb = redis.NewClient(&redis.Options{Addr: mr.Addr()})
	ctx = context.Background()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		w := httptest.NewRecorder()
		rateLimitHandler(w, post("/api/go/rate-limit/check", map[string]any{
			"user_id":        fmt.Sprintf("u%d", i),
			"action":         "post_create",
			"limit":          100,
			"window_seconds": 3600,
		}))
	}
}
