#pragma once
#include <map>
#include <string>
#include <functional>
#include "HttpRequest.hpp"
#include "HttpResponse.hpp"

class Router {
    using Handler = std::function<HttpResponse(const HttpRequest&)>;

    std::map<std::string, Handler> getRoutes_;
    std::map<std::string, Handler> postRoutes_;
    std::map<std::string, Handler> optionsRoutes_; // 1. Added map for OPTIONS

public:
    void get (const std::string& path, Handler h) { getRoutes_[path]     = h; }
    void post(const std::string& path, Handler h) { postRoutes_[path]    = h; }
    void options(const std::string& path, Handler h) { optionsRoutes_[path] = h; } // 2. Added options method

    HttpResponse handle(const HttpRequest& req) const {
        // 3. Update table router lookup logic to check for OPTIONS
        const auto* table =
            (req.method == "GET")     ? &getRoutes_     :
            (req.method == "POST")    ? &postRoutes_    : 
            (req.method == "OPTIONS") ? &optionsRoutes_ : nullptr;

        if (table) {
            auto it = table->find(req.path);
            if (it != table->end())
                return it->second(req);
        }

        return HttpResponse::notFound();
    }
};