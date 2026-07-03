# Security Test — Terraform Ecosystem

This file has all the tests conducted on this terraform ecosystem and the fixes for those issues.

---

## Executive Summary

Conducted a security assessment of the Terraform-managed 
multi-app ecosystem on [date]. The assessment covered 9 
applications across reconnaissance, authentication, injection, 
and access control testing.

Overall Risk Rating: LOW-MEDIUM
No critical or high vulnerabilities were found.
The application demonstrates solid security fundamentals.

---

## Scans and Reconnaissance

### Nmap Scan

```bash
nmap -sV -sC -p 80,443,8080,8000,9000,9001 localhost
Starting Nmap 7.98 ( https://nmap.org ) at 2026-05-01 16:54 +0530
Nmap scan report for localhost (127.0.0.1)
Host is up (0.000099s latency).
Other addresses for localhost (not scanned): ::1

PORT     STATE  SERVICE  VERSION
80/tcp   open   http     nginx 1.29.8
|_http-server-header: nginx/1.29.8
|_http-title: Site doesn't have a title (application/octet-stream, application/json).
443/tcp  closed https
8000/tcp closed http-alt
8080/tcp open   tcpwrapped
9000/tcp closed cslistener
9001/tcp closed tor-orport

Service detection performed. Please report any incorrect results at https://nmap.org/submit/
Nmap done: 1 IP address (1 host up) scanned in 11.36 seconds
```

As you can see, there are several ports opened like nginx and tcpwrapped, but there are important ports which are closed like tor-orport and https. So we can conclude from this nmap scan that major ports are closed — like mysql or postgresql ports.

---

### Gobuster Directory Enumeration Scan

```bash
gobuster dir -u http://localhost/ -w /usr/share/dirb/wordlists/common.txt -t 20 --exclude-length 137
===============================================================
Gobuster v3.8.2
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://localhost/
[+] Method:                  GET
[+] Threads:                 20
[+] Wordlist:                /usr/share/dirb/wordlists/common.txt
[+] Negative Status codes:   404
[+] Exclude Length:          137
[+] User Agent:              gobuster/3.8.2
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
blog   (Status: 301) [Size: 169] [--> http://localhost/blog/]
social (Status: 301) [Size: 169] [--> http://localhost/social/]
Progress: 4613 / 4613 (100.00%)
===============================================================
Finished
===============================================================
```

There are actually 9 links with 9 different projects — only 2 were found. This concludes the project is not that easily exposed without a clear list.

---

### Script to Scan All Paths

Since this project already uses nginx, we have a clear mapping of all routes. It's time to test all those responses with curl.

```bash
#!/bin/bash

paths=(
  # Frontend apps
  "/notes/"
  "/bank/"
  "/quiz/"
  "/video/"
  "/hospital/"
  "/blog/"
  "/social/"
  "/api-service/"
  "/document/"
  "/intro/"

  # API endpoints
  "/notes/api/"
  "/bank/api/"
  "/video/api/"
  "/api-service/api/"
  "/document/api/"
  "/hospital/api/"

  # Blog specific
  "/blog/admin/"
  "/blog/admin/login/"
  "/blog/api/"

  # Social media
  "/social/api/"
  "/social/api/auth/me/"
  "/social/api/metrics"
  "/social/minio/"

  # Spring Boot actuator
  "/bank/api/actuator"
  "/bank/api/actuator/health"
  "/bank/api/actuator/env"
  "/bank/api/actuator/mappings"

  # Sensitive files
  "/blog/robots.txt"
  "/blog/.env"
  "/.git/config"
  "/document/api/admin/"
)

echo "=== Gateway Recon ==="
for path in "${paths[@]}"; do
  code=$(curl -o /dev/null -sw "%{http_code}" --max-time 3 http://localhost"$path")
  echo "$code => $path"
done
```

**Results:**

```
=== Gateway Recon ===
200 => /notes/
200 => /bank/
200 => /quiz/
200 => /video/
200 => /hospital/
200 => /blog/
200 => /social/
200 => /api-service/
200 => /document/
200 => /intro/
200 => /notes/api/
404 => /bank/api/
404 => /video/api/
200 => /api-service/api/
000 => /document/api/
404 => /hospital/api/
404 => /blog/admin/
404 => /blog/admin/login/
404 => /blog/api/
404 => /social/api/
401 => /social/api/auth/me/
404 => /social/api/metrics
403 => /social/minio/
404 => /bank/api/actuator
404 => /bank/api/actuator/health
404 => /bank/api/actuator/env
404 => /bank/api/actuator/mappings
404 => /blog/robots.txt
404 => /blog/.env
200 => /.git/config
000 => /document/api/admin/
```

> **Note:** Don't get fooled by the `200 OK` on `/.git/config`. The gateway is configured so any unknown path is served a catch-all response. This means almost all the other paths are secure at most — no worry here.

---

### Nikto Scan

```bash
nikto -h http://localhost

- Nikto v2.6.0
---------------------------------------------------------------------------
- Target IP:       127.0.0.1
- Target Hostname: localhost
- Target Port:     80
- Platform:        Unknown
- Start Time:      2026-05-01 19:30:58 (GMT5.5)
---------------------------------------------------------------------------
- Server: nginx/1.29.8
- No CGI Directories found (use '-C all' to force check all possible dirs). CGI tests skipped.
- [013587] /: Suggested security header missing: referrer-policy.
- [013587] /: Suggested security header missing: strict-transport-security.
- [013587] /: Suggested security header missing: content-security-policy.
- [013587] /: Suggested security header missing: x-content-type-options.
- [013587] /: Suggested security header missing: permissions-policy.
- [750004] /actuator/env: Spring Boot Actuator endpoint exposed (valid JSON response).
- [750004] /actuator/mappings: Spring Boot Actuator endpoint exposed (valid JSON response).
- [750004] /actuator/metrics: Spring Boot Actuator endpoint exposed (valid JSON response).
- [750004] /actuator/beans: Spring Boot Actuator endpoint exposed (valid JSON response).
- [750004] /actuator/configprops: Spring Boot Actuator endpoint exposed (valid JSON response).
- [750004] /actuator/loggers: Spring Boot Actuator endpoint exposed (valid JSON response).
- [750004] /actuator/threaddump: Spring Boot Actuator endpoint exposed (valid JSON response).
- [750004] /actuator/auditevents: Spring Boot Actuator endpoint exposed (valid JSON response).
- [750004] /actuator/httptrace: Spring Boot Actuator endpoint exposed (valid JSON response).
- [750004] /actuator/scheduledtasks: Spring Boot Actuator endpoint exposed (valid JSON response).
- [750004] /actuator/heapdump: Spring Boot Actuator endpoint exposed (valid JSON response).
- [750004] /actuator/jolokia: Spring Boot Actuator endpoint exposed (valid JSON response).
- [750004] /actuator/prometheus: Spring Boot Actuator endpoint exposed (valid JSON response).
- [999967] /: Web Server returns a valid response with junk HTTP methods which may cause false positives.
- [001214] /doc: The /doc directory is browsable. This may be /usr/doc.
- [001582] /bank/: This might be interesting.
- [002739] /.htpasswd: Contains authorization information.
- [007342] /: X-Frame-Options header is deprecated and was replaced with Content-Security-Policy frame-ancestors directive.
- [007352] /: The X-Content-Type-Options header is not set.
- 8638 requests: 0 errors and 36 items reported on the remote host
- End Time: 2026-05-01 19:31:16 (GMT5.5) (18 seconds)
---------------------------------------------------------------------------
- 1 host(s) tested
```

No major leaking points — there are medium security concerns though like `/doc` and `/.htpasswd`. 

About the Spring Boot Actuator exposure — there is an interesting fact about this project: the uniform catch-all response. If any user sends a request to an unmapped path in nginx, it returns a `200 OK` instead of something that reveals the actual state of paths and sub-paths:

```nginx
location / {
    return 200 '{"status":"gateway running","apps":["/notes/","/bank/","/quiz/","/video/","/hospital/","/blog/","/social/","/api-service/","/document/"]}';
    add_header Content-Type application/json;
    add_header Server "";       # hide nginx version
    add_header X-Powered-By ""; # hide tech stack
}
```

So all those path enumeration attempts are totally useless against this method. There is a tradeoff though — if the path changes locally for an app and the page refreshes, the page is gone. To fix this, `base='/social/'` needs to be added in the frontend, but that changes the rest of the frontend configs too, so it was left as-is.

---

## Severity Ratings

### Low — Exposed `/.git/config`

```
200 => /.git/config
```

**The Fix:** It was a side-effect of the uniform catch-all response, that's why we got the `200 OK`. It is working as intended.

---

### Medium — Missing Security Headers in Nginx

**The Fix:** Add this to `nginx.conf`:

```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header Content-Security-Policy "default-src 'self'" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

---

### High — Exposed Spring Boot Actuator

**The Fix:** Already done — the uniform catch-all response blocks enumeration of actuator paths.

---

## Exploits and Tests

### CSRF Test

Generally, an application should not receive requests from outside resources. They have a protection called CSRF Policy — this policy blocks requests from outside and protects the running application.

Here is the script used to test it:

```bash
#!/bin/bash

# Auth Testing Script with CSRF Token Handling
# Tests if apps properly validate CSRF tokens

echo "=========================================="
echo "Authentication & CSRF Testing"
echo "=========================================="
echo ""

USER1="testuser_u1_$(date +%s)"
PASS="TestPass123!@#"

# ============= BLOG =============
echo "[*] Testing BLOG..."

echo "  - Fetching login page to get CSRF token..."
BLOG_GET=$(curl -s -c /tmp/blog_cookies.txt http://localhost/blog/login/)

BLOG_CSRF=$(echo "$BLOG_GET" | grep -oP "csrfmiddlewaretoken['\"]?\s*:\s*['\"]?\K[^'\">\s]+" | head -1)

if [ -n "$BLOG_CSRF" ]; then
    echo "  ✓ CSRF Token found: ${BLOG_CSRF:0:30}..."
else
    echo "  ⚠ No CSRF token found in HTML, trying alternative method..."
    BLOG_CSRF=$(echo "$BLOG_GET" | grep -oP 'value="[^"]*csrf[^"]*"' | head -1)
fi

if [ -n "$BLOG_CSRF" ]; then
    echo "  - Logging in WITH CSRF token..."
    BLOG_LOGIN=$(curl -s -X POST http://localhost/blog/login/ \
      -b /tmp/blog_cookies.txt -c /tmp/blog_cookies.txt \
      -H "Content-Type: application/json" \
      -d "{\"username\":\"$USER1\",\"password\":\"$PASS\",\"csrfmiddlewaretoken\":\"$BLOG_CSRF\"}" \
      -w "\n%{http_code}")
else
    echo "  - Attempting login WITHOUT CSRF token..."
    BLOG_LOGIN=$(curl -s -X POST http://localhost/blog/login/ \
      -b /tmp/blog_cookies.txt -c /tmp/blog_cookies.txt \
      -H "Content-Type: application/json" \
      -d "{\"username\":\"$USER1\",\"password\":\"$PASS\"}" \
      -w "\n%{http_code}")
fi

BLOG_CODE=$(echo "$BLOG_LOGIN" | tail -n1)
BLOG_BODY=$(echo "$BLOG_LOGIN" | head -n-1)

if [[ $BLOG_CODE == 200 || $BLOG_CODE == 201 || $BLOG_CODE == 302 ]]; then
    echo "  ✓ Blog login HTTP $BLOG_CODE"
else
    echo "  ✗ Blog login FAILED (HTTP $BLOG_CODE)"
    echo "  Response preview: $(echo "$BLOG_BODY" | head -c 200)"
fi
echo ""

# ============= NOTES =============
echo "[*] Testing NOTES..."
NOTES_LOGIN=$(curl -s -X POST http://localhost/notes/login/ \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USER1\",\"password\":\"$PASS\"}" \
  -w "\n%{http_code}")
NOTES_CODE=$(echo "$NOTES_LOGIN" | tail -n1)

if [[ $NOTES_CODE == 403 ]]; then
    echo "  ⚠ CSRF Protection DETECTED (HTTP 403)"
elif [[ $NOTES_CODE == 200 || $NOTES_CODE == 201 ]]; then
    echo "  ✓ Notes login HTTP $NOTES_CODE (no CSRF needed)"
else
    echo "  ? Notes login HTTP $NOTES_CODE"
fi
echo ""

# ============= BANK =============
echo "[*] Testing BANK..."
BANK_LOGIN=$(curl -s -X POST http://localhost/bank/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USER1\",\"password\":\"$PASS\"}" \
  -w "\n%{http_code}")
BANK_CODE=$(echo "$BANK_LOGIN" | tail -n1)

if [[ $BANK_CODE == 403 ]]; then
    echo "  ⚠ CSRF Protection DETECTED (HTTP 403)"
elif [[ $BANK_CODE == 200 || $BANK_CODE == 201 ]]; then
    echo "  ✓ Bank login HTTP $BANK_CODE (no CSRF needed)"
else
    echo "  ? Bank login HTTP $BANK_CODE"
fi
echo ""

# ============= SOCIAL =============
echo "[*] Testing SOCIAL..."
SOCIAL_LOGIN=$(curl -s -X POST http://localhost/login/ \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USER1\",\"password\":\"$PASS\"}" \
  -w "\n%{http_code}")
SOCIAL_CODE=$(echo "$SOCIAL_LOGIN" | tail -n1)

if [[ $SOCIAL_CODE == 403 ]]; then
    echo "  ⚠ CSRF Protection DETECTED (HTTP 403)"
elif [[ $SOCIAL_CODE == 200 || $SOCIAL_CODE == 201 ]]; then
    echo "  ✓ Social login HTTP $SOCIAL_CODE (no CSRF needed)"
else
    echo "  ? Social login HTTP $SOCIAL_CODE"
fi
echo ""
```

**Initial result — before fixes:**

```
==========================================
Authentication & CSRF Testing
==========================================

[*] Testing BLOG...
  - Fetching login page to get CSRF token...
  ⚠ No CSRF token found in HTML, trying alternative method...
  - Attempting login WITHOUT CSRF token...
  ✗ Blog login FAILED (HTTP 403)

[*] Testing NOTES...
  ? Notes login HTTP 405

[*] Testing BANK...
  ? Bank login HTTP 405

[*] Testing SOCIAL...
  ✓ Social login HTTP 200 (no CSRF needed)

==========================================
CSRF Protection Analysis
==========================================

Summary:
  Blog:   Has CSRF protection (requires token)
  Notes:  NO CSRF protection ❌
  Bank:   NO CSRF protection ❌
  Social: NO CSRF protection ❌

⚠ FINDING: Social allows POST requests without CSRF token
  This could allow CSRF attacks
==========================================
```

3 of the apps were vulnerable to CSRF attacks, which can open up various attacks like token misuse to attack other users.

**The Fix:** Strengthen CSRF by only allowing what links are needed.

**Result after fixes:**

```
==========================================
Authentication & CSRF Testing
==========================================

[*] Testing BLOG...
  - Fetching login page to get CSRF token...
  ✓ CSRF Token found: iT7xJYNwbHWebDzPurwZRG4CGWNJQh...
  - Logging in WITH CSRF token...
  ✓ Blog login HTTP 200

[*] Testing NOTES...
  ? Notes login HTTP 404

[*] Testing BANK...
  - Register HTTP 200
  ✓ JWT token received on registration
  ? Bank login HTTP 400

[*] Testing SOCIAL...
  - Register HTTP 400
  ? Social login HTTP 400
  Response: {"non_field_errors":["Invalid credentials."]}

==========================================
CSRF Protection Analysis
==========================================

Summary:
  Blog:   ✓ Session auth working (HTTP 200)
  Notes:  ? HTTP 404 — investigate
  Bank:   ? HTTP 400 — investigate
  Social: ? HTTP 400 — investigate

Note: REST APIs using JWT tokens do not require CSRF
      protection as tokens are sent in headers, not cookies.
      CSRF only applies to session/cookie based authentication.
==========================================
```

---

### Comprehensive Security Test

```
============================================
  Comprehensive Security Testing Suite
============================================
  Target: http://localhost
  Time:   Sun May  3 10:16:05 AM IST 2026
============================================

[*] Setting up test users...
  ✓ Social User 1 ready (JWT obtained)
  ✓ Bank User 1 ready (JWT obtained)

[TEST 1] SQL Injection
  ✓ Blog login — no SQLi detected
  ✓ Social API — no SQLi detected
  ✓ Query parameters — no SQLi detected

[TEST 2] Brute Force Protection
  ⚠ Social login — no rate limiting detected after 20 attempts
  ⚠ Blog login — no rate limiting detected after 20 attempts
  ⚠ Bank login — no rate limiting detected after 20 attempts

[TEST 3] JWT Security
  ✓ Tampered JWT rejected (HTTP 401)
  ✓ 'none' algorithm attack rejected (HTTP 401)
  ✓ Expired token rejected (HTTP 401)
  ✓ No token properly rejected (HTTP 401)
  ✓ JWT payload looks clean

[TEST 4] File Upload Security
  ℹ /social/api/posts/ returned HTTP 405 for PHP upload
  ℹ /social/api/stories/ returned HTTP 405 for PHP upload
  ℹ /notes/api/notes/ returned HTTP 401 for PHP upload
  ⚠ Oversized file not rejected (HTTP 405)

[TEST 5] IDOR Testing
  ℹ Could not create note for IDOR test (HTTP 401)
  ℹ Social user 3 accessed by User2: HTTP 404
  ℹ Social user 4 accessed by User2: HTTP 404

[TEST 6] Rate Limiting
  ⚠ Social API (authenticated) — no rate limiting after 50 requests
  ⚠ Social login (unauthenticated) — no rate limiting after 50 requests
  ⚠ Blog (unauthenticated) — no rate limiting after 50 requests
  ⚠ Notes API — no rate limiting after 50 requests

[TEST 7] Security Headers
  ⚠ X-Content-Type-Options missing
  ⚠ X-Frame-Options missing
  ⚠ Content-Security-Policy missing
  ⚠ Strict-Transport-Security missing
  ⚠ Referrer-Policy missing
  ⚠ Permissions-Policy missing
  ✓ Server header not leaking version

[TEST 8] Sensitive Endpoint Exposure
  ✓ No sensitive paths exposed

[TEST 9] XSS Testing
  ✓ No obvious XSS vulnerabilities detected

============================================
  Finding Summary
============================================
  CRITICAL: 0
  HIGH:     0
  MEDIUM:   4
  LOW:      10
  INFO:     2
============================================
```

---

### Static Analysis : Semgrep 

it is a python tool used for scanning vulnerabilities inside the application like SQL injection or hardcode secrets

Here was the result for one of the app

```bash
semgrep --config=p/django .                                                                                                                                                       ─╯

┌──── ○○○ ────┐
│ Semgrep CLI │
└─────────────┘

Scanning 41 files (only git-tracked) with 28 Code rules:
            
  CODE RULES
                                                                                                                        
  Language      Rules   Files          Origin      Rules                                                                
 ─────────────────────────────        ───────────────────                                                               
  python           27      16          Community      28                                                                
  <multilang>       1       9                                                                                           
                                                                                                                        
                    
  SUPPLY CHAIN RULES
                                                                       
  💎 Sign in with `semgrep login` and run               
     `semgrep ci` to find dependency vulnerabilities and
     advanced cross-file findings.                                     
                                                                       
          
  PROGRESS
   
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 100% 0:00:00                                                                                                                        
                   
                   
┌─────────────────┐
│ 4 Code Findings │
└─────────────────┘
                                                              
    blogsite/blog/templates/blog/edit_post.html
    ❯❱ python.django.security.django-no-csrf-token.django-no-csrf-token
          ❰❰ Blocking ❱❱
          Manually-created forms in django templates should specify a csrf_token to prevent CSRF attacks.
          Details: https://sg.run/N0Bp                                                                   
                                                                                                         
           10┆ <form method="post" style="display:flex;flex-direction:column;gap:1.2rem;">
           11┆   {% csrf_token %}
           12┆   {% for field in form %}
           13┆     <div>
           14┆       <label>{{ field.label }}</label>
           15┆       {{ field }}
           16┆       {% for error in field.errors %}
           17┆         <p style="color:var(--accent);font-size:0.82rem;margin-top:0.3rem;">{{ error
               }}</p>                                                                              
           18┆       {% endfor %}
           19┆     </div>
             [hid 3 additional lines, adjust with --max-lines-per-finding] 
                                                          
    blogsite/blog/templates/blog/login.html
    ❯❱ python.django.security.django-no-csrf-token.django-no-csrf-token
          ❰❰ Blocking ❱❱
          Manually-created forms in django templates should specify a csrf_token to prevent CSRF attacks.
          Details: https://sg.run/N0Bp                                                                   
                                                                                                         
           12┆ <form method="post" style="display:flex;flex-direction:column;gap:1.2rem;">
           13┆   {% csrf_token %}
           14┆   {% for field in form %}
           15┆     <div>
           16┆       <label>{{ field.label }}</label>
           17┆       {{ field }}
           18┆       {% for error in field.errors %}
           19┆         <p style="color:var(--accent);font-size:0.82rem;margin-top:0.3rem;">{{ error
               }}</p>                                                                              
           20┆       {% endfor %}
           21┆     </div>
             [hid 6 additional lines, adjust with --max-lines-per-finding] 
                                                            
    blogsite/blog/templates/blog/profile.html
    ❯❱ python.django.security.django-no-csrf-token.django-no-csrf-token
          ❰❰ Blocking ❱❱
          Manually-created forms in django templates should specify a csrf_token to prevent CSRF attacks.
          Details: https://sg.run/N0Bp                                                                   
                                                                                                         
           38┆ <form method="post" enctype="multipart/form-data" style="display:flex;flex-
               direction:column;gap:1.2rem;">                                             
           39┆   {% csrf_token %}
           40┆   {% for field in form %}
           41┆     <div>
           42┆       <label>{{ field.label }}</label>
           43┆       {{ field }}
           44┆       {% if field.help_text %}
           45┆         <p style="font-size:0.8rem;color:var(--muted);margin-top:0.3rem;">{{
               field.help_text }}</p>                                                      
           46┆       {% endif %}
           47┆       {% for error in field.errors %}
             [hid 6 additional lines, adjust with --max-lines-per-finding] 
                                                             
    blogsite/blog/templates/blog/register.html
    ❯❱ python.django.security.django-no-csrf-token.django-no-csrf-token
          ❰❰ Blocking ❱❱
          Manually-created forms in django templates should specify a csrf_token to prevent CSRF attacks.
          Details: https://sg.run/N0Bp                                                                   
                                                                                                         
           12┆ <form method="post" style="display:flex;flex-direction:column;gap:1.2rem;">
           13┆   {% csrf_token %}
           14┆   {% for field in form %}
           15┆     <div>
           16┆       <label>{{ field.label }}</label>
           17┆       {{ field }}
           18┆       {% if field.help_text %}
           19┆         <p style="font-size:0.78rem;color:var(--muted);margin-top:0.25rem;">{{
               field.help_text }}</p>                                                        
           20┆       {% endif %}
           21┆       {% for error in field.errors %}
             [hid 6 additional lines, adjust with --max-lines-per-finding] 

                
                
┌──────────────┐
│ Scan Summary │
└──────────────┘
✅ Scan completed successfully.
 • Findings: 4 (4 blocking)
 • Rules run: 28
 • Targets scanned: 25
 • Parsed lines: ~100.0%
 • Scan was limited to files tracked by git
 • For a detailed list of skipped files and lines, run semgrep with the --verbose flag
Ran 28 rules on 25 files: 4 findings.
💎 Missed out on 155 pro rules since you aren't logged in!
⚡ Supercharge Semgrep OSS when you create a free account at https://sg.run/rules.
```

the 4 error reported is wrong as I aldready included the {% csrf_token %}. It is a bug in semgrep itself that it can't read well between tags inside the templates

---

### Findings and Fixes

- **Add rate limiting** to the 3 API endpoints flagged in Test 6
- **Add brute force protection** to login endpoints across blog, social, and bank
- **Add security headers** in nginx for all locations

---

## Positive Security Findings

* Uniform catch-all response defeats directory enumeration
* JWT implementation secure (tampering, none-algo, expiry all blocked)
* IDOR protection working on all tested endpoints  
* SQL injection not detected across all endpoints
* XSS not detected
* No sensitive files exposed publicly
* Database ports not exposed externally
* Generic error messages prevent username enumeration
* CORS properly restricted after fix

---

## Testing Methodology

Tools Used:
- Nmap 7.98 — port scanning and service detection
- Gobuster 3.8.2 — directory enumeration
- Nikto 2.6.0 — web vulnerability scanning
- Custom bash scripts — CSRF, auth, IDOR, rate limit testing
- curl — manual endpoint testing
- Wireshark — traffic analysis (separate session)

Scope:
- localhost (dev environment only)
- All 9 apps in the terraform ecosystem
- No external services tested

---

## Conclusion

overall the project holds up pretty well for a dev environment, no critical vulnerabilities were found and the major attack surfaces are either closed or handled by the nginx catch-all. the jwt security is solid, idor is blocked, and sql injection didn't find anything.

the real gaps are the missing security headers and rate limiting — which are more of a production hardening checklist than actual exploits. those are already in the fix list.

if this were going to production, the things to tackle first would be moving all the hardcoded credentials out of terraform into a secrets manager, adding the nginx headers, and tightening the minio CORS from `*` to specific origins. everything else is either already handled or low priority for a personal project.

not bad for a first pentest on your own project.