#!/usr/bin/env bash
# probe-register.sh
# Probes likely registration endpoints across all apps and reports the response.
# Run from any directory. Requires curl.

set -u

BASE="http://localhost"

# app_name|path|method
TARGETS=(
  "notes|/notes/api/auth/register/|POST"
  "notes|/notes/api/register/|POST"
  "notes|/notes/api/users/|POST"
  "notes|/notes/api/health/|GET"
  "notes|/notes/api/|GET"

  "blog|/blog/register/|POST"
  "blog|/blog/accounts/register/|POST"
  "blog|/blog/api/register/|POST"
  "blog|/blog/login/|GET"

  "bank|/bank/api/auth/register|POST"
  "bank|/bank/api/register|POST"
  "bank|/bank/api/users/register|POST"
  "bank|/bank/api/auth/login|POST"
  "bank|/bank/api/|GET"

  "video|/video/api/auth/register|POST"
  "video|/video/api/register|POST"
  "video|/video/api/users|POST"
  "video|/video/api/|GET"

  "hospital|/hospital/register/|POST"
  "hospital|/hospital/api/register/|POST"
  "hospital|/hospital/accounts/register/|POST"
  "hospital|/hospital/login/|GET"

  "api-service|/api-service/api/auth/register/|POST"
  "api-service|/api-service/api/register/|POST"
  "api-service|/api-service/api/users/|POST"
  "api-service|/api-service/api/|GET"

  "document|/document/api/auth/register/|POST"
  "document/api/register/|POST"
  "document|/document/api/users/|POST"
  "document|/document/api/|GET"

  "compiler|/compiler/api/health|GET"
  "compiler|/compiler/api/|GET"

  "social|/social/api/auth/register/|POST"
  "social|/social/api/register/|POST"
  "social|/social/api/|GET"
)

printf "%-14s %-45s %-6s %-6s %-10s\n" "APP" "PATH" "METHOD" "STATUS" "REDIRECT"
printf "%-14s %-45s %-6s %-6s %-10s\n" "----" "----" "------" "------" "--------"

for entry in "${TARGETS[@]}"; do
  IFS='|' read -r app path method <<< "$entry"

  # -s silent, -o /dev/null discard body, -w write-out format
  # -X method, -L follow redirects (but record if it happened)
  result=$(curl -s -o /dev/null \
    -X "$method" \
    -H "Content-Type: application/json" \
    -d '{}' \
    -w "%{http_code}|%{redirect_url}" \
    --max-time 5 \
    "${BASE}${path}" 2>/dev/null)

  status="${result%%|*}"
  redirect="${result##*|}"

  # Color code: 2xx green, 3xx yellow, 4xx red-ish, 5xx red
  case "$status" in
    2*) color="\033[0;32m" ;;
    3*) color="\033[0;33m" ;;
    4*) color="\033[0;35m" ;;
    5*) color="\033[0;31m" ;;
    000) color="\033[0;90m" ;;
    *)  color="\033[0m" ;;
  esac
  reset="\033[0m"

  printf "%-14s %-45s %-6s ${color}%-6s${reset} %-10s\n" \
    "$app" "$path" "$method" "$status" "${redirect:0:30}"
done