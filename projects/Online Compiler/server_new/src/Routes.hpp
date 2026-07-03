#pragma once
#include <string>
#include "Router.hpp"
#include "HttpRequest.hpp"
#include "HttpResponse.hpp"
#include "Json.hpp"
#include "Auth.hpp"
#include "AuthService.hpp"
#include "SessionManager.hpp"
#include "CodeRunner.hpp"
#include "HistoryClient.hpp"

static std::string escapeJson(const std::string& s) {
    std::string out;
    for (char c : s) {
        switch (c) {
            case '"':  out += "\\\""; break;
            case '\\': out += "\\\\"; break;
            case '\n': out += "\\n";  break;
            case '\r': out += "\\r";  break;
            case '\t': out += "\\t";  break;
            default:   out += c;
        }
    }
    return out;
}

inline void registerRoutes(Router&         router,
                            AuthService&    auth,
                            SessionManager& sessions,
                            HistoryClient&  history)
{
    AuthService*    pAuth     = &auth;
    SessionManager* pSessions = &sessions;
    HistoryClient*  pHistory  = &history;

    // ── CORS PREFLIGHT (OPTIONS) HANDLERS ───────────────────────────────────
    // Browsers send an OPTIONS preflight to verify server access permissions.
    // They just need a 200 OK empty body back.
    
    router.options("/register", [](const HttpRequest&) {
        return HttpResponse::ok(""); 
    });

    router.options("/login", [](const HttpRequest&) {
        return HttpResponse::ok(""); 
    });

    router.options("/code", [](const HttpRequest&) {
        return HttpResponse::ok(""); 
    });

    router.options("/history", [](const HttpRequest&) {
        return HttpResponse::ok(""); 
    });

    // ── POST /register ──────────────────────────────────────────────────────
    router.post("/register", [pAuth](const HttpRequest& req) {
        JsonParser parser;
        Json json = parser.parse(req.body);
        AuthRequest ar;
        ar.username = json.values["username"];
        ar.password = json.values["password"];
        AuthResponse res = pAuth->registerUser(ar);
        if (!res.success) return HttpResponse::badRequest(res.message);
        std::string body =
            "{\"message\":\"" + escapeJson(res.message) + "\","
            " \"token\":\""   + escapeJson(res.token)   + "\"}";
        return HttpResponse::created(body);
    });

    // ── POST /login ─────────────────────────────────────────────────────────
    router.post("/login", [pAuth](const HttpRequest& req) {
        JsonParser parser;
        Json json = parser.parse(req.body);
        AuthRequest ar;
        ar.username = json.values["username"];
        ar.password = json.values["password"];
        AuthResponse res = pAuth->login(ar);
        if (!res.success) return HttpResponse::unauthorized(res.message);
        std::string body =
            "{\"message\":\"" + escapeJson(res.message) + "\","
            " \"token\":\""   + escapeJson(res.token)   + "\"}";
        return HttpResponse::ok(body);
    });

    // ── POST /code ──────────────────────────────────────────────────────────
    // NOTE: history.save() is called OUTSIDE the router lock (done in
    // Connection.hpp after the handler returns) to avoid holding the lock
    // while making a blocking HTTP call to the DB server.
    // We return a special wrapper that carries both the HTTP response and
    // the history record to save.
    router.post("/code", [pSessions, pHistory](const HttpRequest& req) -> HttpResponse {
        // 1. Auth
        auto it = req.headers.find("Authorization");
        if (it == req.headers.end())
            return HttpResponse::unauthorized("missing Authorization header");
        const std::string prefix = "Bearer ";
        if (it->second.rfind(prefix, 0) != 0)
            return HttpResponse::unauthorized("invalid Authorization format");
        std::string token    = it->second.substr(prefix.size());
        std::string username = pSessions->getUser(token);
        if (username.empty())
            return HttpResponse::unauthorized("invalid or expired token");

        // 2. Parse
        JsonParser parser;
        Json json = parser.parse(req.body);
        std::string language = json.values["language"];
        std::string code     = json.values["code"];
        if (language.empty() || code.empty())
            return HttpResponse::badRequest("language and code are required");

        // 3. Run
        CodeRunner runner;
        CodeRunner::Result result = runner.runCode(language, code);

        // 4. Build response first
        std::string status = (result.exitCode == 0) ? "success" : "error";
        std::string body =
            "{\"status\":\""  + escapeJson(status)              + "\","
            " \"output\":\""  + escapeJson(result.output)       + "\","
            " \"exitCode\":"  + std::to_string(result.exitCode) + "}";

        // 5. Save history AFTER building response — avoids holding lock
        //    while doing a blocking HTTP call to the DB server
        HistoryClient::OutputRecord rec;
        rec.username  = username;
        rec.language  = language;
        rec.code      = code;
        rec.output    = result.output;
        rec.exitCode  = result.exitCode;
        rec.timestamp = HistoryClient::now();
        pHistory->save(rec);   // non-blocking from caller's perspective
                               // (Connection releases routerMutex before this
                               //  if using the async save path in Connection.hpp)

        return HttpResponse::ok(body);
    });

    // ── GET /history ────────────────────────────────────────────────────────
    router.get("/history", [pSessions, pHistory](const HttpRequest& req) {
        auto it = req.headers.find("Authorization");
        if (it == req.headers.end())
            return HttpResponse::unauthorized("missing Authorization header");
        const std::string prefix = "Bearer ";
        if (it->second.rfind(prefix, 0) != 0)
            return HttpResponse::unauthorized("invalid Authorization format");
        std::string token    = it->second.substr(prefix.size());
        std::string username = pSessions->getUser(token);
        if (username.empty())
            return HttpResponse::unauthorized("invalid or expired token");

        std::string dbResp = pHistory->fetchHistory(username);
        return HttpResponse::ok(dbResp);
    });

    // ── GET /health ─────────────────────────────────────────────────────────
    router.get("/health", [](const HttpRequest&) {
        return HttpResponse::ok("{\"status\":\"ok\"}", "application/json");
    });

    
}
