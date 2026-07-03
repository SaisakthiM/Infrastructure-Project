#include <iostream>
#include <cstdlib>
#include <sqlite3.h>

#include "src/SQLiteUserRepository.hpp"
#include "src/CustomDBUserRepository.hpp"
#include "src/SessionManager.hpp"
#include "src/AuthService.hpp"
#include "src/Router.hpp"
#include "src/Routes.hpp"
#include "src/Connection.hpp"
#include "src/HistoryClient.hpp"

int main() {
    // ── Read DB host/port from environment (set by docker-compose) ────────
    // Falls back to 127.0.0.1:8080 for local development without Docker
    const char* envHost = std::getenv("DB_HOST");
    const char* envPort = std::getenv("DB_PORT");
    std::string dbHost  = envHost ? envHost : "127.0.0.1";
    int         dbPort  = envPort ? std::stoi(envPort) : 8080;

    std::cout << "[info] DB backend: " << dbHost << ":" << dbPort << "\n";

    // ── 1. SQLite backup ──────────────────────────────────────────────────
    sqlite3* db = nullptr;
    if (sqlite3_open("users.db", &db) != SQLITE_OK) {
        std::cerr << "[fatal] cannot open SQLite: " << sqlite3_errmsg(db) << "\n";
        return 1;
    }
    SQLiteUserRepository sqliteRepo(db);
    sqliteRepo.initSchema();

    // ── 2. Custom DB as primary user store ────────────────────────────────
    CustomDBUserRepository::Config dbCfg;
    dbCfg.dbHost    = dbHost;
    dbCfg.dbPort    = dbPort;
    dbCfg.dbName    = "auth";
    dbCfg.tableName = "users";
    CustomDBUserRepository repo(dbCfg, sqliteRepo);

    // ── 3. History client ─────────────────────────────────────────────────
    HistoryClient::Config hCfg;
    hCfg.host = dbHost;
    hCfg.port = dbPort;
    HistoryClient history(hCfg);

    // ── 4. Auth + sessions ────────────────────────────────────────────────
    SessionManager sessions;
    AuthService    auth(repo, sessions);

    // ── 5. Routes ─────────────────────────────────────────────────────────
    Router router;
    registerRoutes(router, auth, sessions, history);

    // ── 6. Start ──────────────────────────────────────────────────────────
    Connection server(router, 9090, 4);
    if (!server.start()) return 1;

    std::cout << "[info] auth server :9090 | DB " << dbHost << ":" << dbPort
              << " | SQLite backup: users.db\n";
    server.run();

    sqlite3_close(db);
    return 0;
}
