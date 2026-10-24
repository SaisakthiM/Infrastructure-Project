"""
Who is this citizen? Ask the bank (D-01).

Same contract every ward uses (AGENTS.md §7): the browser replays its bank bearer token and account
id at us, we replay them at GET {BANK_API_URL}/accounts/{id}. The bank answers 200 only when the
token is valid *and* that account belongs to the token, and its payload carries the customer name.
We never parse the JWT and keep no shared secret.

Safe Mode follows the city: a verification stays fresh for 60 s; when the bank is unreachable (not
"denied") an identity verified within the last 24 h is still accepted.
"""
import json
import os
import time
import urllib.error
import urllib.request

BANK_API_URL = os.environ.get("BANK_API_URL", "http://bank-backend:8080/api").rstrip("/")
_FRESH_SECONDS = 60
_STALE_SECONDS = 24 * 3600
_cache = {}  # (account_id, token) -> (verified_at, who)


def _lookup(account_id, token, timeout=2.5):
    """-> ("ok", data) | ("denied", None) | ("down", None)"""
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
    data = payload.get("data") or {}
    return ("ok", data) if data.get("id") else ("denied", None)


def verify(request):
    """Verified city session -> {"account_id", "customer_name", "account_number"}, else None."""
    auth = request.headers.get("Authorization", "")
    account_id = request.headers.get("X-City-Account", "")
    if not auth.startswith("Bearer ") or not account_id.isdigit():
        return None

    key = (account_id, auth[7:].strip())
    now = time.time()
    hit = _cache.get(key)
    if hit and now - hit[0] < _FRESH_SECONDS:
        return hit[1]

    state, data = _lookup(*key)
    if state == "ok":
        who = {
            "account_id": int(account_id),
            "customer_name": (data.get("customerName") or "").strip(),
            "account_number": (data.get("accountNumber") or ""),
        }
        if len(_cache) > 2000:
            _cache.clear()
        _cache[key] = (now, who)
        return who
    if state == "denied":
        _cache.pop(key, None)
        return None
    if hit and now - hit[0] < _STALE_SECONDS:  # bank down, citizen recently seen
        return hit[1]
    return None
