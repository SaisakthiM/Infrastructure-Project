#pragma once
#include <string>
#include <vector>
#include <sys/socket.h>
#include <arpa/inet.h>
#include <unistd.h>
#include <ctime>
#include <iostream>

// ── HistoryClient ─────────────────────────────────────────────────────────────
// Stores every code execution result into the custom C++ DB as a row in:
//   database: history
//   table:    outputs
//   columns:  username, language, code, output, exit_code, timestamp
//
// Also provides fetchHistory(username) to retrieve all runs for a user.
//
struct HistoryClient {

    struct Config {
        std::string host = "127.0.0.1";
        int         port = 8080;
    };

    struct OutputRecord {
        std::string username;
        std::string language;
        std::string code;
        std::string output;
        int         exitCode;
        std::string timestamp;
    };

    explicit HistoryClient(const Config& cfg) : cfg_(cfg) {
        ensureTable();
    }

    // Call this after every /code execution
    void save(const OutputRecord& rec) {
        std::string body =
            "{\"database_name\":\"history\","
            "\"table_name\":\"outputs\","
            "\"username\":\""  + escapeJson(rec.username)  + "\","
            "\"language\":\""  + escapeJson(rec.language)  + "\","
            "\"code\":\""      + escapeJson(rec.code)      + "\","
            "\"output\":\""    + escapeJson(rec.output)    + "\","
            "\"exit_code\":\""  + std::to_string(rec.exitCode) + "\","
            "\"timestamp\":\"" + escapeJson(rec.timestamp) + "\"}";

        std::string resp = httpPost("/insert", body);
        if (resp.find("\"status\":true") != std::string::npos)
            std::cout << "[history] saved run for " << rec.username << "\n";
        else
            std::cerr << "[history] save failed: " << resp << "\n";
    }

    // Returns a JSON array string of all runs for the given username
    std::string fetchHistory(const std::string& username) {
        std::string resp = httpGet("/field_search",
            "database_name=history&table_name=outputs"
            "&field=username&value=" + urlEncode(username));

        if (resp.find("\"status\":true") != std::string::npos)
            return resp;   // caller formats this for the HTTP response

        std::cerr << "[history] fetch failed: " << resp << "\n";
        return "{\"status\":false,\"message\":\"could not retrieve history\"}";
    }

    // Returns ISO-8601-ish timestamp for now
    static std::string now() {
        std::time_t t = std::time(nullptr);
        char buf[32];
        std::strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%S", std::localtime(&t));
        return buf;
    }

private:
    Config cfg_;

    void ensureTable() {
        std::string body =
            "{\"database_name\":\"history\","
            "\"table_name\":\"outputs\","
            "\"columns\":\"username:string,language:string,"
                          "code:string,output:string,"
                          "exit_code:string,timestamp:string\"}";
        std::string resp = httpPost("/create", body);
        if (resp.find("\"status\":true") != std::string::npos)
            std::cout << "[history] table ready\n";
        else
            std::cerr << "[history] ensureTable: " << resp << "\n";
    }

    // ── Minimal HTTP client (same pattern as CustomDBUserRepository) ──────

    int connectToDb() const {
        int sock = socket(AF_INET, SOCK_STREAM, 0);
        if (sock < 0) return -1;

        sockaddr_in addr{};
        addr.sin_family = AF_INET;
        addr.sin_port   = htons(static_cast<uint16_t>(cfg_.port));
        inet_pton(AF_INET, cfg_.host.c_str(), &addr.sin_addr);

        struct timeval tv{ 2, 0 };
        setsockopt(sock, SOL_SOCKET, SO_RCVTIMEO, &tv, sizeof(tv));
        setsockopt(sock, SOL_SOCKET, SO_SNDTIMEO, &tv, sizeof(tv));

        if (connect(sock, reinterpret_cast<sockaddr*>(&addr), sizeof(addr)) < 0) {
            close(sock); return -1;
        }
        return sock;
    }

    std::string readBody(int sock) const {
        std::string raw;
        char buf[4096];
        ssize_t n;
        while ((n = recv(sock, buf, sizeof(buf) - 1, 0)) > 0) {
            buf[n] = '\0'; raw += buf;
        }
        size_t p = raw.find("\r\n\r\n");
        return (p == std::string::npos) ? raw : raw.substr(p + 4);
    }

    std::string httpPost(const std::string& path, const std::string& body) const {
        int sock = connectToDb();
        if (sock < 0) return "";
        std::string req =
            "POST " + path + " HTTP/1.1\r\n"
            "Host: " + cfg_.host + "\r\n"
            "Content-Type: application/json\r\n"
            "Content-Length: " + std::to_string(body.size()) + "\r\n"
            "Connection: close\r\n\r\n" + body;
        send(sock, req.c_str(), req.size(), 0);
        std::string resp = readBody(sock);
        close(sock);
        return resp;
    }

    std::string httpGet(const std::string& path, const std::string& query) const {
        int sock = connectToDb();
        if (sock < 0) return "";
        std::string req =
            "GET " + path + "?" + query + " HTTP/1.1\r\n"
            "Host: " + cfg_.host + "\r\n"
            "Connection: close\r\n\r\n";
        send(sock, req.c_str(), req.size(), 0);
        std::string resp = readBody(sock);
        close(sock);
        return resp;
    }

    static std::string escapeJson(const std::string& s) {
        std::string out;
        for (char c : s) {
            if      (c == '"')  out += "\\\"";
            else if (c == '\\') out += "\\\\";
            else if (c == '\n') out += "\\n";
            else if (c == '\r') out += "\\r";
            else if (c == '\t') out += "\\t";
            else                out += c;
        }
        return out;
    }

    static std::string urlEncode(const std::string& s) {
        std::string out;
        for (unsigned char c : s) {
            if (std::isalnum(c) || c == '-' || c == '_' || c == '.' || c == '~')
                out += static_cast<char>(c);
            else { char h[4]; snprintf(h, sizeof(h), "%%%02X", c); out += h; }
        }
        return out;
    }
};
