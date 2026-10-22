#pragma once
#include <string>
#include <cstring>
#include <iostream>
#include <netinet/in.h>
#include <sys/socket.h>
#include <unistd.h>
#include "HttpParser.hpp"
#include "HttpRequest.hpp"
#include "Cors.hpp"
#include "Json.hpp"


// ── Routes ───────────────────────────────────────────────────────────────────
// POST /create        → create database + table
// POST /insert        → insert a row (type-validated)
// GET  /search        → search by id  (?database_name=&table_name=&id=)
// GET  /field_search  → search by field (?database_name=&table_name=&field=&value=)

enum class Route { CREATE, INSERT, SEARCH, FIELD_SEARCH, UNKNOWN };

struct Interface {
private:
    int         serverSocket;
    sockaddr_in serverAddress;
    HttpParser  parser;
    JsonParser  jsonParser;

public:
    int clientSocket = -1;

    void startConnection() {
        serverSocket = socket(AF_INET, SOCK_STREAM, 0);
        int opt = 1;
        setsockopt(serverSocket, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));

        serverAddress.sin_family      = AF_INET;
        serverAddress.sin_port        = htons(8080);
        serverAddress.sin_addr.s_addr = INADDR_ANY;
        bind(serverSocket, (struct sockaddr*)&serverAddress, sizeof(serverAddress));
        listen(serverSocket, 5);
        std::cout << "DB server listening on :8080\n";
    }

    void acceptConnection() {
        clientSocket = accept(serverSocket, nullptr, nullptr);
    }

    void closeClient() {
        if (clientSocket >= 0) {
            close(clientSocket);
            clientSocket = -1;
        }
    }

    HttpRequest readRequest() {
        return parser.parseRequest(clientSocket);
    }

    static Route route(const HttpRequest& req) {
        if (req.path == "/create"       && req.method == "POST") return Route::CREATE;
        if (req.path == "/insert"       && req.method == "POST") return Route::INSERT;
        if (req.path == "/search"       && req.method == "GET")  return Route::SEARCH;
        if (req.path == "/field_search" && req.method == "GET")  return Route::FIELD_SEARCH;
        return Route::UNKNOWN;
    }

    Json parseBody(const HttpRequest& req) {
        return jsonParser.parse(req.body);
    }

    Json parseQuery(const HttpRequest& req) {
        Json json;
        std::string q = req.query;
        size_t i = 0;
        while (i < q.size()) {
            size_t eq  = q.find('=', i);
            if (eq == std::string::npos) break;
            size_t amp = q.find('&', eq);
            std::string key = q.substr(i, eq - i);
            std::string val = (amp == std::string::npos)
                              ? q.substr(eq + 1)
                              : q.substr(eq + 1, amp - eq - 1);
            // URL-decode '+' → ' '
            for (char& c : val) if (c == '+') c = ' ';
            json.values[key] = val;
            i = (amp == std::string::npos) ? q.size() : amp + 1;
        }
        return json;
    }

    void sendOk(const std::string& body, const HttpRequest& req) {
        sendHttp(body, "200 OK", req);
    }

    void sendPreflight(const HttpRequest& req) {
        sendHttp("", "204 No Content", req);
    }


private:
    static std::string escape(const std::string& s) {
        std::string out;
        for (char c : s) {
            if (c == '"')  out += "\\\"";
            else if (c == '\\') out += "\\\\";
            else out += c;
        }
        return out;
    }

    // CORS is a property of who asked, not of the route, so every reply gets
    // the same treatment: echo the Origin back only when the allowlist in
    // Cors.hpp recognises it. Server-to-server calls carry no Origin and so
    // carry no CORS headers.
    void sendHttp(const std::string& body, const std::string& status,
                  const HttpRequest& req) {
        std::string origin = cors::responseOrigin(req);

        std::string response =
            "HTTP/1.1 " + status + "\r\n"
            "Content-Type: application/json\r\n";

        if (status.rfind("204", 0) != 0)
            response += "Content-Length: " + std::to_string(body.size()) + "\r\n";

        if (!origin.empty()) {
            response += "Access-Control-Allow-Origin: " + origin + "\r\n";
            response += "Vary: Origin\r\n";
            response += "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n";
            response += "Access-Control-Allow-Headers: Content-Type, Authorization\r\n";
            response += "Access-Control-Max-Age: 86400\r\n";
        }

        response += "Connection: close\r\n"
            "\r\n" + body;
        ::send(clientSocket, response.c_str(), response.size(), 0);
    }
    

    
};
