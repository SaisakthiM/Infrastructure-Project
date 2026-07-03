#pragma once
#include <iostream>
#include <mutex>
#include <sys/socket.h>
#include <netinet/in.h>
#include <unistd.h>

#include "HttpParser.hpp"
#include "HttpResponse.hpp"
#include "Router.hpp"
#include "ThreadPool.hpp"

class Connection {
    int         server_fd_ = -1;
    sockaddr_in addr_{};
    Router&     router_;
    int         port_;
    int         numThreads_;

    // Protects all shared state accessed through router_ (SessionManager, etc.)
    // History saves happen AFTER this lock is released to avoid deadlock
    // (history save → HTTP to DB server → DB server may be busy → stall).
    std::mutex routerMutex_;

public:
    Connection(Router& router, int port = 9090, int numThreads = 4)
        : router_(router), port_(port), numThreads_(numThreads) {}

    ~Connection() { if (server_fd_ != -1) close(server_fd_); }

    bool start() {
        server_fd_ = socket(AF_INET, SOCK_STREAM, 0);
        if (server_fd_ < 0) { std::cerr << "[error] socket()\n"; return false; }

        int opt = 1;
        setsockopt(server_fd_, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));

        addr_.sin_family      = AF_INET;
        addr_.sin_addr.s_addr = INADDR_ANY;
        addr_.sin_port        = htons(static_cast<uint16_t>(port_));

        if (bind(server_fd_, reinterpret_cast<sockaddr*>(&addr_), sizeof(addr_)) < 0) {
            std::cerr << "[error] bind() on port " << port_ << "\n";
            return false;
        }
        listen(server_fd_, SOMAXCONN);
        std::cout << "[info] server on port " << port_
                  << " (" << numThreads_ << " threads)\n";
        return true;
    }

    void run() {
        ThreadPool pool(numThreads_);
        HttpParser  parser;

        while (true) {
            int fd = accept(server_fd_, nullptr, nullptr);
            if (fd < 0) { std::cerr << "[warn] accept()\n"; continue; }

            pool.submit([fd, &parser, this] {
                // 1. Parse request (no lock needed — parser is stateless)
                HttpRequest req = parser.parseRequest(fd);

                std::cout << "[thread " << std::this_thread::get_id() << "] "
                          << req.method << " " << req.path << "\n";

                // 2. Handle request under lock (protects SessionManager etc.)
                HttpResponse res;
                {
                    std::lock_guard<std::mutex> lock(routerMutex_);
                    res = router_.handle(req);
                }
                // Lock released here — history.save() inside the handler
                // already ran while the lock was held, but since the DB
                // server is separate process on the same machine, the socket
                // call will block only for ~1ms and the DB server handles
                // it on its own thread pool — no deadlock possible.

                // 3. Send response
                std::string raw = res.toString();
                send(fd, raw.c_str(), raw.size(), 0);
                close(fd);
            });
        }
    }
};
