"""
Who is calling? Ask the city bank.

The browser sends the citizen's bank JWT and account id. We replay them against
GET {BANK_API_URL}/accounts/{id}: the bank answers 200 only if the token is valid AND owns that account,
and the answer carries the username (customerName).

A verified identity is trusted for 60 s. If the bank is unreachable (not "denied"), one verified within
24 h is still accepted so the district keeps working in the city's Safe Mode.
"""
import os
import time

import httpx
from fastapi import Header, HTTPException

BANK_API_URL = os.environ.get("BANK_API_URL", "http://bank-backend:8080/api").rstrip("/")
FRESH_SECONDS = 60
STALE_SECONDS = 24 * 3600
_cache: dict[tuple[str, str], tuple[float, str]] = {}


async def _lookup(account_id: str, token: str) -> tuple[str, str | None]:
    """-> ("ok", name) | ("denied", None) | ("down", None)"""
    try:
        async with httpx.AsyncClient(timeout=2.5) as client:
            res = await client.get(
                f"{BANK_API_URL}/accounts/{account_id}",
                headers={"Authorization": f"Bearer {token}", "Accept": "application/json"},
            )
    except httpx.HTTPError:
        return "down", None
    if res.status_code == 200:
        try:
            name = (res.json().get("data") or {}).get("customerName")
        except ValueError:
            return "down", None
        return ("ok", name) if name else ("denied", None)
    if res.status_code in (400, 401, 403, 404):
        return "denied", None
    return "down", None


async def verify(authorization: str | None, account_id: str | None) -> str | None:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    if not account_id or not account_id.isdigit() or len(account_id) > 18:
        return None
    token = authorization[7:].strip()
    key = (account_id, token)
    now = time.time()
    hit = _cache.get(key)
    if hit and now - hit[0] < FRESH_SECONDS:
        return hit[1]

    state, name = await _lookup(account_id, token)
    if state == "ok" and name:
        if len(_cache) > 2000:
            _cache.clear()
        _cache[key] = (now, name)
        return name
    if state == "denied":
        _cache.pop(key, None)
        return None
    if hit and now - hit[0] < STALE_SECONDS:
        return hit[1]
    return None


async def current_citizen(
    authorization: str | None = Header(default=None),
    x_city_account: str | None = Header(default=None),
) -> str:
    """FastAPI dependency: the verified citizen, or 401."""
    name = await verify(authorization, x_city_account)
    if not name:
        raise HTTPException(status_code=401, detail="Log in to the city bank first.")
    return name
