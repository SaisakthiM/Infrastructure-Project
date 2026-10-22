#pragma once
#include <cctype>
#include <cstdlib>
#include <string>
#include <vector>
#include "HttpRequest.hpp"

// ── Origin allowlist ─────────────────────────────────────────────────────────
// Same rules as the auth server's Cors.hpp (these two services keep their own
// copy of the HTTP plumbing): echo the request Origin back only when it is
// allowlisted. The DB server is normally reached server-to-server over
// gateway-net, where no Origin header exists and no CORS headers are sent at
// all — this only matters when something in a browser talks to it directly.
//
// Accepted: the production origin, any http/https loopback origin on any port
// (localhost, 127.x, [::1]) for local development, plus everything listed in
// the CORS_ALLOWED_ORIGINS env var — comma, semicolon or space separated.
// An entry written without "://" matches on host alone; "*" allows all.
namespace cors {

inline std::string lower(std::string s) {
    for (char& c : s)
        c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
    return s;
}

struct Parsed {
    bool        ok = false;
    std::string scheme;
    std::string host;   // always lowercased, brackets kept for IPv6
    std::string port;
};

inline Parsed split(const std::string& origin) {
    Parsed p;
    size_t sep = origin.find("://");
    if (sep == std::string::npos) return p;

    p.scheme = lower(origin.substr(0, sep));
    std::string rest = origin.substr(sep + 3);

    size_t cut = rest.find_first_of("/?#");
    if (cut != std::string::npos) rest = rest.substr(0, cut);
    if (rest.empty()) return p;

    if (rest.front() == '[') {
        size_t close = rest.find(']');
        if (close == std::string::npos) return p;
        p.host = lower(rest.substr(0, close + 1));
        if (rest.size() > close + 1 && rest[close + 1] == ':')
            p.port = rest.substr(close + 2);
    } else {
        size_t colon = rest.rfind(':');
        if (colon == std::string::npos) {
            p.host = lower(rest);
        } else {
            p.host = lower(rest.substr(0, colon));
            p.port = rest.substr(colon + 1);
        }
    }
    p.ok     = !p.host.empty();
    return p;
}

inline bool loopback(const std::string& host) {
    return host == "localhost" || host == "[::1]" || host == "::1"
        || (host.rfind("127.", 0) == 0);
}

// Built-in production origins — CORS_ALLOWED_ORIGINS adds to these, it does
// not replace them.
inline const std::vector<std::string>& builtins() {
    static const std::vector<std::string> list = {
        "https://saisakthi.qzz.io",
        "http://saisakthi.qzz.io",
        "https://www.saisakthi.qzz.io",
    };
    return list;
}

inline std::vector<std::string> fromEnv() {
    std::vector<std::string> out;
    const char* env = std::getenv("CORS_ALLOWED_ORIGINS");
    if (!env) return out;

    std::string raw(env);
    size_t i = 0;
    while (i < raw.size()) {
        size_t j = raw.find_first_of(",; \t", i);
        if (j == std::string::npos) j = raw.size();
        if (j > i) out.push_back(lower(raw.substr(i, j - i)));
        i = j + 1;
    }
    return out;
}

inline bool matches(const std::string& entry, const std::string& origin, const Parsed& p) {
    if (entry == "*") return true;
    if (entry.find("://") != std::string::npos) return entry == origin;
    return p.ok && entry == p.host;   // host-only entry: scheme and port are free
}

inline bool allowed(const std::string& originRaw) {
    std::string origin = lower(originRaw);
    if (origin.empty() || origin == "null") return false;

    Parsed p = split(origin);
    for (const auto& entry : fromEnv())  if (matches(entry, origin, p)) return true;
    for (const auto& entry : builtins()) if (entry == origin) return true;

    return p.ok && (p.scheme == "http" || p.scheme == "https") && loopback(p.host);
}

// Case-insensitive header lookup — HttpParser keeps the wire casing.
inline std::string header(const HttpRequest& req, const std::string& name) {
    for (const auto& kv : req.headers)
        if (lower(kv.first) == lower(name)) return kv.second;
    return "";
}

// The Origin to echo back for this request; empty means send no CORS headers.
inline std::string responseOrigin(const HttpRequest& req) {
    std::string origin = header(req, "Origin");
    return allowed(origin) ? origin : std::string();
}

} // namespace cors
