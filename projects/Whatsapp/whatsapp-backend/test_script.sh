#!/bin/bash

BASE_URL="http://localhost:8000"
WS_PORT="8000"   # backend WebSocket also runs on 8000
BOLD='\033[1m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

pass() { echo -e "${GREEN}✓ $1${NC}"; }
fail() { echo -e "${RED}✗ $1${NC}"; }
info() { echo -e "${CYAN}→ $1${NC}"; }
section() { echo -e "\n${BOLD}${YELLOW}── $1 ──${NC}"; }

check_status() {
  local label=$1; local expected=$2; local actual=$3
  if [ "$actual" == "$expected" ]; then pass "$label (HTTP $actual)"
  else fail "$label (expected $expected, got $actual)"; fi
}

# ── 1. Health check ──────────────────────────────────────────────────────────
section "Health check"
RES=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/")
check_status "GET /" "200" "$RES"

# ── 2. Register two users ────────────────────────────────────────────────────
section "Register user A"
USERNAME_A="user_a_$$"; PASSWORD="password123"
REG_A=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/users" \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"$USERNAME_A\", \"password\": \"$PASSWORD\"}")
REG_A_BODY=$(echo "$REG_A" | head -n -1)
REG_A_STATUS=$(echo "$REG_A" | tail -n1)
check_status "POST /users (A)" "200" "$REG_A_STATUS"
TOKEN_A=$(echo "$REG_A_BODY" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
USER_A=$(echo "$REG_A_BODY" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

section "Register user B"
USERNAME_B="user_b_$$"
REG_B=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/users" \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"$USERNAME_B\", \"password\": \"$PASSWORD\"}")
REG_B_BODY=$(echo "$REG_B" | head -n -1)
REG_B_STATUS=$(echo "$REG_B" | tail -n1)
check_status "POST /users (B)" "200" "$REG_B_STATUS"
TOKEN_B=$(echo "$REG_B_BODY" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
USER_B=$(echo "$REG_B_BODY" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

# ── 3. Login ─────────────────────────────────────────────────────────────────
section "Login"
LOGIN=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"$USERNAME_A\", \"password\": \"$PASSWORD\"}")
LOGIN_BODY=$(echo "$LOGIN" | head -n -1); LOGIN_STATUS=$(echo "$LOGIN" | tail -n1)
check_status "POST /login" "200" "$LOGIN_STATUS"
FRESH=$(echo "$LOGIN_BODY" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
[ -n "$FRESH" ] && TOKEN_A=$FRESH && pass "Login token received" || fail "No token from login"

# ── 4. Create room ────────────────────────────────────────────────────────────
section "Create room"
ROOM=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/room" \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"test-room-$$\", \"creator_id\": \"$USER_A\"}")
ROOM_BODY=$(echo "$ROOM" | head -n -1); ROOM_STATUS=$(echo "$ROOM" | tail -n1)
check_status "POST /room" "200" "$ROOM_STATUS"
ROOM_ID=$(echo "$ROOM_BODY" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

# ── 5. Both users join room ───────────────────────────────────────────────────
section "Join room"
JOIN_A=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/room/join" \
  -H "Content-Type: application/json" \
  -d "{\"room_id\": \"$ROOM_ID\", \"user_id\": \"$USER_A\"}")
check_status "POST /room/join (A)" "201" "$JOIN_A"

JOIN_B=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/room/join" \
  -H "Content-Type: application/json" \
  -d "{\"room_id\": \"$ROOM_ID\", \"user_id\": \"$USER_B\"}")
check_status "POST /room/join (B)" "201" "$JOIN_B"

# ── 6. Send HTTP message ──────────────────────────────────────────────────────
section "Send message (HTTP)"
MSG=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/message" \
  -H "Content-Type: application/json" \
  -d "{\"room_id\": \"$ROOM_ID\", \"sender_id\": \"$USER_A\", \"content\": \"Hello from HTTP!\"}")
MSG_BODY=$(echo "$MSG" | head -n -1); MSG_STATUS=$(echo "$MSG" | tail -n1)
check_status "POST /message" "200" "$MSG_STATUS"

# ── 7. WebSocket tests ────────────────────────────────────────────────────────
section "WebSocket"
if ! command -v websocat &> /dev/null; then
  echo -e "${YELLOW}⚠ websocat not found — skipping WebSocket tests${NC}"
else
  info "Basic connection (User A)"
  timeout 2 websocat "ws://localhost:$WS_PORT/ws/$ROOM_ID?token=$TOKEN_A" < /dev/null
fi

echo -e "\n${BOLD}Done.${NC}"
