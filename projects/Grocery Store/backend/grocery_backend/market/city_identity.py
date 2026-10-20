"""
Who is calling? Ask the city bank.

The browser sends the citizen's bank JWT plus their account id. We never parse or trust the token
ourselves: we replay it against GET {BANK_API_URL}/accounts/{id}. The bank only answers 200 when the
token is valid AND the account belongs to that token's owner, and its answer carries the username.

Returns the verified username, or None (no headers, bad token, bank unreachable and never seen before).

Caching:
  * a verified identity is trusted for 60 s (one bank call per burst of requests)
  * if the bank is UNREACHABLE (not "denied"), an identity verified within the last 24 h is still
    accepted, so districts keep working in the city's Safe Mode. A bank answer of 401/403 always wins.
"""
import json
import os
import time
import urllib.error
import urllib.request

BANK_API_URL = os.environ.get("BANK_API_URL", "http://bank-backend:8080/api").rstrip("/")
_FRESH_SECONDS = 60
_STALE_SECONDS = 24 * 3600
_cache = {}  # (account_id, token) -> (verified_at, username)


def _lookup(account_id, token, timeout=2.5):
    """-> ("ok", username) | ("denied", None) | ("down", None)"""
    req = urllib.request.Request(
        f"{BANK_API_URL}/accounts/{account_id}",
        headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            payload = json.load(resp)
    except urllib.error.HTTPError as exc:
        return ("denied", None) if exc.code in (400, 401, 403, 404) else ("down", None)
    except (urllib.error.URLError, TimeoutError, ValueError, OSError):
        return ("down", None)
    name = (payload.get("data") or {}).get("customerName")
    return ("ok", name) if name else ("denied", None)


def identity_for(request):
    auth = request.headers.get("Authorization", "")
    account_id = request.headers.get("X-City-Account", "")
    if not auth.startswith("Bearer ") or not account_id.isdigit():
        return None
    token = auth[7:].strip()
    key = (account_id, token)
    now = time.time()
    hit = _cache.get(key)
    if hit and now - hit[0] < _FRESH_SECONDS:
        return hit[1]

    state, username = _lookup(account_id, token)
    if state == "ok":
        if len(_cache) > 2000:
            _cache.clear()
        _cache[key] = (now, username)
        return username
    if state == "denied":
        _cache.pop(key, None)
        return None
    # bank down: fall back to a recent verification, if we have one
    if hit and now - hit[0] < _STALE_SECONDS:
        return hit[1]
    return None
