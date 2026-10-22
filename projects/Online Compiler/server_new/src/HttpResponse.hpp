#pragma once
#include <string>
#include "Status.hpp"

struct HttpResponse {
    int         statusCode  = 200;
    std::string body;
    std::string contentType = "application/json";

    // Filled in by Connection from the request's Origin, through the cors::
    // allowlist in Cors.hpp. Empty means this response carries no CORS headers.
    std::string allowOrigin;

    std::string toString() const {
        std::string r;
        r += "HTTP/1.1 " + std::to_string(statusCode) + " ";
        r += Status::reasonPhrase(statusCode) + "\r\n";
        r += "Content-Type: "   + contentType + "\r\n";
        if (statusCode != 204)
            r += "Content-Length: " + std::to_string(body.size()) + "\r\n";

        // ── CORS ────────────────────────────────────────────────────────────
        // Only an allowlisted origin is echoed back, so the cached response
        // cannot be read from another site: Vary: Origin keeps shared caches
        // from handing one origin's answer to a different one.
        if (!allowOrigin.empty()) {
            r += "Access-Control-Allow-Origin: " + allowOrigin + "\r\n";
            r += "Vary: Origin\r\n";
            r += "Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS\r\n";
            r += "Access-Control-Allow-Headers: Content-Type, Authorization\r\n";
            r += "Access-Control-Max-Age: 86400\r\n";
        }
        // ────────────────────────────────────────────────────────────────────

        r += "Connection: close\r\n";
        r += "\r\n";
        r += body;
        return r;
    }

    // ── Convenience builders ───────────────────────────────────────────────
    static HttpResponse ok(const std::string& body,
                           const std::string& ct = "application/json") {
        HttpResponse r; r.statusCode = 200; r.body = body; r.contentType = ct;
        return r;
    }
    static HttpResponse created(const std::string& body) {
        HttpResponse r; r.statusCode = 201; r.body = body; return r;
    }
    static HttpResponse preflight() {
        HttpResponse r; r.statusCode = 204; return r;
    }
    static HttpResponse badRequest(const std::string& msg) {
        HttpResponse r;
        r.statusCode = 400;
        r.body = "{\"error\":\"" + msg + "\"}";
        return r;
    }
    static HttpResponse unauthorized(const std::string& msg = "Unauthorized") {
        HttpResponse r;
        r.statusCode = 401;
        r.body = "{\"error\":\"" + msg + "\"}";
        return r;
    }
    static HttpResponse notFound() {
        HttpResponse r;
        r.statusCode = 404;
        r.body = "{\"error\":\"Route not found\"}";
        return r;
    }
    static HttpResponse internalError(const std::string& msg = "Internal server error") {
        HttpResponse r;
        r.statusCode = 500;
        r.body = "{\"error\":\"" + msg + "\"}";
        return r;
    }
};
