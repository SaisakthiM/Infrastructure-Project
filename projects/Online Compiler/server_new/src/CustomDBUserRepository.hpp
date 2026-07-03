#pragma once
#include <string>
#include <sstream>
#include <iostream>
#include <cstring>
#include <sys/socket.h>
#include <arpa/inet.h>
#include <unistd.h>
#include "UserRepository.hpp"
#include "SQLiteUserRepository.hpp"

// ── CustomDBUserRepository ────────────────────────────────────────────────────
// Primary storage: our custom C++ database server (HTTP on DB_HOST:DB_PORT).
// Fallback storage: SQLite (via SQLiteUserRepository).
//
// The custom DB stores users in a table named "users" inside database "auth",
// with schema:   username:string,password_hash:string
//
// Endpoints used:
//   POST /create  – one-time table creation
//   POST /insert  – store a new user
//   GET  /search  – find by id (not useful for username lookup)
//   GET  /field_search?database_name=auth&table_name=users&field=username&value=X
//                 – find by username (uses BTree field scan)
//
class CustomDBUserRepository : public UserRepository {
public:
    struct Config {
        std::string dbHost    = "127.0.0.1";
        int         dbPort    = 8080;
        std::string dbName    = "auth";
        std::string tableName = "users";
    };

    // sqlite is the fallback; it must outlive this object.
    CustomDBUserRepository(const Config& cfg, SQLiteUserRepository& sqlite)
        : cfg_(cfg), sqlite_(sqlite)
    {
        ensureTable();
    }

    // ── createUser ────────────────────────────────────────────────────────
    bool createUser(const User& user) override {
        std::string body =
            "{\"database_name\":\"" + cfg_.dbName + "\","
            "\"table_name\":\""     + cfg_.tableName + "\","
            "\"username\":\""       + escapeJson(user.username) + "\","
            "\"password_hash\":\""  + std::to_string(user.passwordHash) + "\"}";

        std::string resp = httpPost("/insert", body);
        if (resp.find("\"status\":true") != std::string::npos) {
            std::cout << "[CustomDB] createUser ok: " << user.username << "\n";
            // Mirror to SQLite as backup
            sqlite_.createUser(user);
            return true;
        }
        std::cerr << "[CustomDB] createUser failed, falling back to SQLite: " << resp << "\n";
        return sqlite_.createUser(user);
    }

    // ── userExists ────────────────────────────────────────────────────────
    bool userExists(const std::string& username) override {
        // Try custom DB field_search
        std::string resp = httpGet("/field_search",
            "database_name=" + cfg_.dbName +
            "&table_name="   + cfg_.tableName +
            "&field=username&value=" + urlEncode(username));

        if (resp.find("\"count\":0") != std::string::npos) return false;
        if (resp.find("\"status\":true") != std::string::npos &&
            resp.find("\"count\":") != std::string::npos)
        {
            // Extract count value
            size_t p = resp.find("\"count\":");
            if (p != std::string::npos) {
                size_t start = p + 8;
                size_t end   = resp.find_first_of(",}", start);
                int count = std::stoi(resp.substr(start, end - start));
                return count > 0;
            }
        }
        // Custom DB unreachable – fall back to SQLite
        std::cerr << "[CustomDB] userExists fallback to SQLite\n";
        return sqlite_.userExists(username);
    }

    // ── findUser ──────────────────────────────────────────────────────────
    User findUser(const std::string& username) override {
        std::string resp = httpGet("/field_search",
            "database_name=" + cfg_.dbName +
            "&table_name="   + cfg_.tableName +
            "&field=username&value=" + urlEncode(username));

        if (resp.find("\"status\":true") != std::string::npos &&
            resp.find("\"count\":0") == std::string::npos)
        {
            User u;
            u.username     = username;
            u.passwordHash = extractPasswordHash(resp);
            if (u.passwordHash != 0) {
                std::cout << "[CustomDB] findUser ok: " << username << "\n";
                return u;
            }
        }
        std::cerr << "[CustomDB] findUser fallback to SQLite\n";
        return sqlite_.findUser(username);
    }

private:
    Config                 cfg_;
    SQLiteUserRepository&  sqlite_;
    bool                   tableReady_ = false;

    // ── Ensure the users table exists in the custom DB ────────────────────
    void ensureTable() {
        std::string body =
            "{\"database_name\":\"" + cfg_.dbName + "\","
            "\"table_name\":\""     + cfg_.tableName + "\","
            "\"columns\":\"username:string,password_hash:string\"}";

        std::string resp = httpPost("/create", body);
        // "Table created" or "Table already exists" – both are fine
        if (resp.find("\"status\":true") != std::string::npos) {
            tableReady_ = true;
            std::cout << "[CustomDB] table ready: "
                      << cfg_.dbName << "/" << cfg_.tableName << "\n";
        } else {
            std::cerr << "[CustomDB] ensureTable warning: " << resp << "\n";
            // Non-fatal: SQLite will cover us
            tableReady_ = false;
        }
    }

    // ── Tiny synchronous HTTP client ──────────────────────────────────────
    // Returns the raw response body (or empty string on error).

    int connectToDb() const {
        int sock = socket(AF_INET, SOCK_STREAM, 0);
        if (sock < 0) return -1;

        sockaddr_in addr{};
        addr.sin_family = AF_INET;
        addr.sin_port   = htons(static_cast<uint16_t>(cfg_.dbPort));
        inet_pton(AF_INET, cfg_.dbHost.c_str(), &addr.sin_addr);

        // Short timeout so a missing DB doesn't stall the server
        struct timeval tv{};
        tv.tv_sec  = 2;
        tv.tv_usec = 0;
        setsockopt(sock, SOL_SOCKET, SO_RCVTIMEO, &tv, sizeof(tv));
        setsockopt(sock, SOL_SOCKET, SO_SNDTIMEO, &tv, sizeof(tv));

        if (connect(sock, reinterpret_cast<sockaddr*>(&addr), sizeof(addr)) < 0) {
            close(sock);
            return -1;
        }
        return sock;
    }

    std::string readResponse(int sock) const {
        std::string raw;
        char buf[4096];
        ssize_t n;
        while ((n = recv(sock, buf, sizeof(buf) - 1, 0)) > 0) {
            buf[n] = '\0';
            raw += buf;
        }
        // Strip HTTP headers – find the blank line
        size_t hdrEnd = raw.find("\r\n\r\n");
        if (hdrEnd == std::string::npos) return raw;
        return raw.substr(hdrEnd + 4);
    }

    std::string httpPost(const std::string& path, const std::string& body) const {
        int sock = connectToDb();
        if (sock < 0) return "";

        std::string req =
            "POST " + path + " HTTP/1.1\r\n"
            "Host: " + cfg_.dbHost + "\r\n"
            "Content-Type: application/json\r\n"
            "Content-Length: " + std::to_string(body.size()) + "\r\n"
            "Connection: close\r\n"
            "\r\n" + body;

        send(sock, req.c_str(), req.size(), 0);
        std::string resp = readResponse(sock);
        close(sock);
        return resp;
    }

    std::string httpGet(const std::string& path, const std::string& query) const {
        int sock = connectToDb();
        if (sock < 0) return "";

        std::string fullPath = path + (query.empty() ? "" : "?" + query);
        std::string req =
            "GET " + fullPath + " HTTP/1.1\r\n"
            "Host: " + cfg_.dbHost + "\r\n"
            "Connection: close\r\n"
            "\r\n";

        send(sock, req.c_str(), req.size(), 0);
        std::string resp = readResponse(sock);
        close(sock);
        return resp;
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    // Extract password_hash from field_search JSON response
    // Response looks like: {"status":true,"count":1,"data":[{"id":1,"username":"x","password_hash":"12345"}]}
    static long long extractPasswordHash(const std::string& resp) {
        size_t p = resp.find("\"password_hash\":\"");
        if (p == std::string::npos) return 0;
        size_t start = p + 17;
        size_t end   = resp.find('"', start);
        if (end == std::string::npos) return 0;
        std::string val = resp.substr(start, end - start);
        try { return std::stoll(val); } catch (...) { return 0; }
    }

    static std::string escapeJson(const std::string& s) {
        std::string out;
        for (char c : s) {
            if (c == '"')  out += "\\\"";
            else if (c == '\\') out += "\\\\";
            else out += c;
        }
        return out;
    }

    // Minimal URL encoding (only characters that break query strings)
    static std::string urlEncode(const std::string& s) {
        std::string out;
        for (unsigned char c : s) {
            if (std::isalnum(c) || c == '-' || c == '_' || c == '.' || c == '~') {
                out += static_cast<char>(c);
            } else {
                char hex[4];
                snprintf(hex, sizeof(hex), "%%%02X", c);
                out += hex;
            }
        }
        return out;
    }
};
