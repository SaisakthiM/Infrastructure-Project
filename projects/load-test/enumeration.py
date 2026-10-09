#!/usr/bin/env python3
"""
enumeration.py — probe known endpoints, classify by content-type, not just status.
Filters out SPA fallbacks (200 + text/html) which are not real APIs.
"""
import json, os, time
import requests

BASE = os.environ.get("BASE_URL", "https://saisakthi.qzz.io").rstrip("/")
RATE = float(os.environ.get("RATE", "5"))
OUT = "/work/out/endpoints.json"
os.makedirs("/work/out", exist_ok=True)

# Only paths we're confident exist. No .env/.git/actuator noise.
APPS = [
    ("compiler",     "/compiler",    ["/api/health", "/api/"], "none"),
    ("api-service",  "/api-service", ["/api/", "/api/metrics", "/api/users"], "none"),
    ("video",        "/video",       ["/api/getFiles", "/api/actuator/health", "/api/upload"], "none"),
    ("document",     "/document",    ["/books/", "/books/1/", "/books/1/recommendations/"], "none"),
    ("blog",         "/blog",        ["/", "/login/", "/register/"], "session"),
    ("hospital",     "/hospital",    ["/", "/patients/", "/doctors/"], "session"),
    ("notes",        "/notes",       ["/api/", "/api/notes/", "/api/token/", "/api/user/register/"], "jwt"),
    ("bank",         "/bank",        ["/api/accounts", "/api/auth/login", "/api/auth/register"], "jwt"),
    ("social",       "/social",      ["/api/auth/register/", "/api/auth/login/", "/api/auth/me/",
                                       "/api/posts/", "/api/notifications/unread/"], "jwt"),
]

METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"]

def probe(url, method):
    try:
        r = requests.request(method, url, timeout=5, allow_redirects=False)
        ctype = r.headers.get("Content-Type", "").lower()
        return r.status_code, ctype, r.headers.get("Allow", "")
    except Exception:
        return 0, "", ""

def classify(status, ctype):
    """
    Real APIs return JSON or specific content types.
    200 + text/html is almost always an SPA fallback page, not an endpoint.
    """
    if status == 0:      return "timeout"
    if status == 404:    return "missing"
    if status >= 500:    return "server-error"
    if status in (401, 403): return "auth-required"
    if status in (301, 302): return "redirect"
    if status == 405:    return "method-not-allowed"
    if "application/json" in ctype:  return "api"
    if status in (200, 201, 204):
        if "text/html" in ctype:     return "spa-fallback"   # <-- filter this out
        return "public"
    return "unknown"

def main():
    out = []
    for app, prefix, paths, auth in APPS:
        print(f"\n=== {app} ({prefix}) auth={auth} ===", flush=True)
        for path in paths:
            full = prefix + path
            url = BASE + full

            # First, OPTIONS to learn allowed methods (best effort)
            _, _, allow_hdr = probe(url, "OPTIONS")
            allowed = [m.strip() for m in allow_hdr.split(",") if m.strip()] or ["GET"]
            time.sleep(1.0 / RATE)

            for method in allowed:
                if method not in METHODS:
                    continue
                status, ctype, _ = probe(url, method)
                time.sleep(1.0 / RATE)

                klass = classify(status, ctype)
                entry = {
                    "app": app, "path": full, "method": method,
                    "status": status, "ctype": ctype, "class": klass, "auth": auth,
                }
                out.append(entry)
                # Only print real, useful entries
                if klass not in ("spa-fallback", "missing", "timeout"):
                    print(f"  {method:7s} {full:55s} {status:4d} {ctype[:30]:30s} -> {klass}")

    # Write FULL results to disk (so you can audit), and FILTERED results for k6
    with open(OUT, "w") as f:
        json.dump(out, f, indent=2)

    useful = [e for e in out if e["class"] in ("api", "public", "auth-required", "method-not-allowed")]
    with open("/work/out/useful.json", "w") as f:
        json.dump(useful, f, indent=2)

    print(f"\nFull: {len(out)} entries -> {OUT}")
    print(f"Useful: {len(useful)} entries -> /work/out/useful.json")

if __name__ == "__main__":
    main()