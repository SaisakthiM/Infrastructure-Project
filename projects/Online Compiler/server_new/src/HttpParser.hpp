#pragma once
#include <string>
#include <sstream>
#include <sys/socket.h>
#include "HttpRequest.hpp"

struct HttpParser {

    HttpRequest parseRequest(int client_fd) const {
        char        buffer[4096];
        std::string raw;

        // Read at least the headers (may also contain part of the body)
        int bytes = recv(client_fd, buffer, sizeof(buffer), 0);
        if (bytes > 0)
            raw.append(buffer, bytes);

        // Split headers from body
        size_t header_end = raw.find("\r\n\r\n");
        if (header_end == std::string::npos)
            return {};                  // malformed request

        std::string header_part = raw.substr(0, header_end);
        std::string body_part   = raw.substr(header_end + 4);

        HttpRequest req;
        std::istringstream stream(header_part);
        std::string line;

        // Request line: METHOD /path HTTP/1.x
        std::getline(stream, line);
        if (!line.empty() && line.back() == '\r') line.pop_back();
        {
            std::istringstream rl(line);
            std::string target;
            rl >> req.method >> target >> req.version;

            size_t q = target.find('?');
            if (q != std::string::npos) {
                req.path  = target.substr(0, q);
                req.query = target.substr(q + 1);
            } else {
                req.path = target;
            }
        }

        // Headers
        int content_length = 0;
        while (std::getline(stream, line)) {
            if (line == "\r" || line.empty()) break;
            if (line.back() == '\r') line.pop_back();

            size_t colon = line.find(':');
            if (colon == std::string::npos) continue;

            std::string key   = line.substr(0, colon);
            std::string value = line.substr(colon + 1);
            if (!value.empty() && value[0] == ' ') value.erase(0, 1);

            req.headers[key] = value;
            if (key == "Content-Length")
                content_length = std::stoi(value);
        }

        // Body — keep reading until we have content_length bytes
        if (content_length > 0) {
            req.body = body_part;
            while (static_cast<int>(req.body.size()) < content_length) {
                int n = recv(client_fd, buffer, sizeof(buffer), 0);
                if (n <= 0) break;
                req.body.append(buffer, n);
            }
            req.body = req.body.substr(0, content_length);
        }

        return req;
    }
};
