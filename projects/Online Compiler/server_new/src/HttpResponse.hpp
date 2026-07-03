#pragma once
#include <string>
#include "Status.hpp"

struct HttpResponse {
    int         statusCode  = 200;
    std::string body;
    std::string contentType = "application/json";

    std::string toString() const {
        std::string r;
        r += "HTTP/1.1 " + std::to_string(statusCode) + " ";
        r += Status::reasonPhrase(statusCode) + "\r\n";
        r += "Content-Type: "   + contentType + "\r\n";
        r += "Content-Length: " + std::to_string(body.size()) + "\r\n";
        
        // ── COMPLETE CORS HEADERS ───────────────────────────────────────────
        // Allows requests from your React origin (or use "*" for wildcard)
        r += "Access-Control-Allow-Origin: http://localhost:3000\r\n";
        // Allows the browser to send GET, POST, and preflight OPTIONS requests
        r += "Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS\r\n";
        // Crucial for allowing your React app to pass the Authorization token
        r += "Access-Control-Allow-Headers: Content-Type, Authorization\r\n";
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