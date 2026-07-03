package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"
)

var (
	rdb *redis.Client
	ctx = context.Background()
)

// ── Response helpers ──────────────────────────────────────────────────────────

func jsonOK(w http.ResponseWriter, data any) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}

func jsonErr(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

// ── Health ────────────────────────────────────────────────────────────────────

func healthHandler(w http.ResponseWriter, r *http.Request) {
	if _, err := rdb.Ping(ctx).Result(); err != nil {
		jsonErr(w, "redis unreachable", 503)
		return
	}
	jsonOK(w, map[string]string{"status": "healthy", "service": "go-microservice"})
}

// ── Rate Limiting ─────────────────────────────────────────────────────────────
// POST /api/go/rate-limit/check
// Body: {"user_id": "123", "action": "post_create", "limit": 10, "window_seconds": 3600}
// Django calls this before allowing expensive actions (post create, follow, DM).

func rateLimitHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonErr(w, "method not allowed", 405)
		return
	}

	var req struct {
		UserID        string `json:"user_id"`
		Action        string `json:"action"`
		Limit         int    `json:"limit"`
		WindowSeconds int    `json:"window_seconds"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "invalid body", 400)
		return
	}

	key := fmt.Sprintf("ratelimit:%s:%s", req.UserID, req.Action)
	window := time.Duration(req.WindowSeconds) * time.Second

	// Atomic increment + set expiry only if key is new
	pipe := rdb.Pipeline()
	incr := pipe.Incr(ctx, key)
	pipe.Expire(ctx, key, window)
	if _, err := pipe.Exec(ctx); err != nil {
		jsonErr(w, "redis error", 500)
		return
	}

	count := incr.Val()
	allowed := count <= int64(req.Limit)

	ttl, _ := rdb.TTL(ctx, key).Result()
	jsonOK(w, map[string]any{
		"allowed":     allowed,
		"current":     count,
		"limit":       req.Limit,
		"reset_in_ms": ttl.Milliseconds(),
	})
}

// ── User Presence ─────────────────────────────────────────────────────────────
// POST /api/go/presence/heartbeat
// Body: {"user_id": "123"}
// Frontend sends this every 30s while tab is open.

func presenceHeartbeatHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonErr(w, "method not allowed", 405)
		return
	}

	var req struct {
		UserID string `json:"user_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "invalid body", 400)
		return
	}

	key := fmt.Sprintf("presence:%s", req.UserID)
	// Mark online with 60s TTL — if no heartbeat for 60s, key expires = offline
	rdb.Set(ctx, key, time.Now().Unix(), 60*time.Second)
	jsonOK(w, map[string]string{"status": "ok"})
}

// GET /api/go/presence/{user_id}
// Returns whether a user is currently online.

func presenceGetHandler(w http.ResponseWriter, r *http.Request) {
	userID := r.PathValue("user_id")
	if userID == "" {
		jsonErr(w, "user_id required", 400)
		return
	}

	key := fmt.Sprintf("presence:%s", userID)
	val, err := rdb.Get(ctx, key).Result()
	online := err == nil && val != ""

	lastSeen := int64(0)
	if online {
		lastSeen, _ = strconv.ParseInt(val, 10, 64)
	} else {
		// Check last-seen timestamp (set on logout/heartbeat expiry)
		lsKey := fmt.Sprintf("last_seen:%s", userID)
		ls, _ := rdb.Get(ctx, lsKey).Result()
		lastSeen, _ = strconv.ParseInt(ls, 10, 64)
	}

	jsonOK(w, map[string]any{
		"user_id":   userID,
		"online":    online,
		"last_seen": lastSeen,
	})
}

// POST /api/go/presence/bulk
// Body: {"user_ids": ["1","2","3"]}
// Check presence of multiple users at once (for DM list, comments, etc.)

func presenceBulkHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonErr(w, "method not allowed", 405)
		return
	}

	var req struct {
		UserIDs []string `json:"user_ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "invalid body", 400)
		return
	}

	result := make(map[string]bool)
	for _, uid := range req.UserIDs {
		key := fmt.Sprintf("presence:%s", uid)
		exists, _ := rdb.Exists(ctx, key).Result()
		result[uid] = exists > 0
	}

	jsonOK(w, map[string]any{"presence": result})
}

// ── Feed Cache ────────────────────────────────────────────────────────────────
// POST /api/go/cache/feed
// Body: {"user_id": "123", "feed_json": "...", "ttl_seconds": 300}
// Django calls this after assembling a feed to cache it for 5 min.

func cacheFeedSetHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonErr(w, "method not allowed", 405)
		return
	}

	var req struct {
		UserID     string `json:"user_id"`
		FeedJSON   string `json:"feed_json"`
		TTLSeconds int    `json:"ttl_seconds"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "invalid body", 400)
		return
	}

	key := fmt.Sprintf("feed_cache:%s", req.UserID)
	ttl := time.Duration(req.TTLSeconds) * time.Second
	if ttl == 0 {
		ttl = 5 * time.Minute
	}

	rdb.Set(ctx, key, req.FeedJSON, ttl)
	jsonOK(w, map[string]string{"status": "cached"})
}

// GET /api/go/cache/feed/{user_id}
// Returns cached feed JSON or 404 if expired/missing.

func cacheFeedGetHandler(w http.ResponseWriter, r *http.Request) {
	userID := r.PathValue("user_id")
	key := fmt.Sprintf("feed_cache:%s", userID)

	val, err := rdb.Get(ctx, key).Result()
	if err == redis.Nil {
		jsonErr(w, "cache miss", 404)
		return
	}
	if err != nil {
		jsonErr(w, "redis error", 500)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	fmt.Fprint(w, val)
}

// DELETE /api/go/cache/feed/{user_id}
// Django calls this when a user the person follows creates a post —
// invalidates stale cache so next request rebuilds fresh.

func cacheFeedInvalidateHandler(w http.ResponseWriter, r *http.Request) {
	userID := r.PathValue("user_id")
	key := fmt.Sprintf("feed_cache:%s", userID)
	rdb.Del(ctx, key)
	jsonOK(w, map[string]string{"status": "invalidated"})
}

// ── Typing Indicators ─────────────────────────────────────────────────────────
// POST /api/go/typing
// Body: {"conversation_id": "5", "user_id": "123"}
// Frontend calls this while user is typing in DMs.

func typingHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonErr(w, "method not allowed", 405)
		return
	}

	var req struct {
		ConversationID string `json:"conversation_id"`
		UserID         string `json:"user_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "invalid body", 400)
		return
	}

	// Key expires in 3s — if frontend doesn't re-send, typing stops
	key := fmt.Sprintf("typing:%s:%s", req.ConversationID, req.UserID)
	rdb.Set(ctx, key, "1", 3*time.Second)
	jsonOK(w, map[string]string{"status": "ok"})
}

// GET /api/go/typing/{conversation_id}
// Returns list of user_ids currently typing in a conversation.

func typingGetHandler(w http.ResponseWriter, r *http.Request) {
	convID := r.PathValue("conversation_id")

	pattern := fmt.Sprintf("typing:%s:*", convID)
	keys, _ := rdb.Keys(ctx, pattern).Result()

	typingUsers := []string{}
	for _, k := range keys {
		// Extract user_id from "typing:{conv_id}:{user_id}"
		var convPart, userID string
		fmt.Sscanf(k, "typing:%s:%s", &convPart, &userID)
		typingUsers = append(typingUsers, userID)
	}

	jsonOK(w, map[string]any{"typing": typingUsers})
}

// ── Unread Message Count ──────────────────────────────────────────────────────
// POST /api/go/unread/increment
// Body: {"user_id": "123", "conversation_id": "5"}

func unreadIncrementHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonErr(w, "method not allowed", 405)
		return
	}

	var req struct {
		UserID         string `json:"user_id"`
		ConversationID string `json:"conversation_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "invalid body", 400)
		return
	}

	key := fmt.Sprintf("unread:%s:%s", req.UserID, req.ConversationID)
	total := fmt.Sprintf("unread_total:%s", req.UserID)
	rdb.Incr(ctx, key)
	rdb.Incr(ctx, total)
	jsonOK(w, map[string]string{"status": "ok"})
}

// POST /api/go/unread/clear
// Body: {"user_id": "123", "conversation_id": "5"}

func unreadClearHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonErr(w, "method not allowed", 405)
		return
	}

	var req struct {
		UserID         string `json:"user_id"`
		ConversationID string `json:"conversation_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonErr(w, "invalid body", 400)
		return
	}

	key := fmt.Sprintf("unread:%s:%s", req.UserID, req.ConversationID)
	count, _ := rdb.Get(ctx, key).Int64()
	rdb.Del(ctx, key)

	totalKey := fmt.Sprintf("unread_total:%s", req.UserID)
	rdb.DecrBy(ctx, totalKey, count)
	jsonOK(w, map[string]string{"status": "cleared"})
}

// GET /api/go/unread/{user_id}
// Total unread message count across all conversations.

func unreadTotalHandler(w http.ResponseWriter, r *http.Request) {
	userID := r.PathValue("user_id")
	key := fmt.Sprintf("unread_total:%s", userID)
	count, _ := rdb.Get(ctx, key).Int64()
	jsonOK(w, map[string]any{"user_id": userID, "unread_count": count})
}

// ── Main ──────────────────────────────────────────────────────────────────────

func main() {
	redisHost := os.Getenv("REDIS_HOST")
	if redisHost == "" {
		redisHost = "redis"
	}
	redisPort := os.Getenv("REDIS_PORT")
	if redisPort == "" {
		redisPort = "6379"
	}

	rdb = redis.NewClient(&redis.Options{
		Addr:     fmt.Sprintf("%s:%s", redisHost, redisPort),
		Password: "",
		DB:       0,
	})

	if _, err := rdb.Ping(ctx).Result(); err != nil {
		log.Fatalf("Cannot connect to Redis: %v", err)
	}
	log.Println("Connected to Redis!")

	mux := http.NewServeMux()

	// Health
	mux.HandleFunc("GET /", healthHandler)
	mux.HandleFunc("GET /health", healthHandler)

	// Rate limiting
	mux.HandleFunc("POST /api/go/rate-limit/check", rateLimitHandler)

	// Presence
	mux.HandleFunc("POST /api/go/presence/heartbeat", presenceHeartbeatHandler)
	mux.HandleFunc("GET  /api/go/presence/{user_id}", presenceGetHandler)
	mux.HandleFunc("POST /api/go/presence/bulk", presenceBulkHandler)

	// Feed cache
	mux.HandleFunc("POST   /api/go/cache/feed", cacheFeedSetHandler)
	mux.HandleFunc("GET    /api/go/cache/feed/{user_id}", cacheFeedGetHandler)
	mux.HandleFunc("DELETE /api/go/cache/feed/{user_id}", cacheFeedInvalidateHandler)

	// Typing indicators
	mux.HandleFunc("POST /api/go/typing", typingHandler)
	mux.HandleFunc("GET  /api/go/typing/{conversation_id}", typingGetHandler)

	// Unread counts
	mux.HandleFunc("POST /api/go/unread/increment", unreadIncrementHandler)
	mux.HandleFunc("POST /api/go/unread/clear", unreadClearHandler)
	mux.HandleFunc("GET  /api/go/unread/{user_id}", unreadTotalHandler)

	log.Println("Go microservice listening on :8080")
	log.Fatal(http.ListenAndServe(":8080", mux))
}
