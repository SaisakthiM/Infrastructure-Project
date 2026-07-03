#pragma once
#include <sqlite3.h>
#include <stdexcept>
#include "UserRepository.hpp"

// Requires: link with -lsqlite3
// DB must have been opened before constructing this class.
// Schema (call initSchema() once after opening):
//   CREATE TABLE IF NOT EXISTS users (
//       username      TEXT PRIMARY KEY,
//       password_hash INTEGER NOT NULL
//   );

class SQLiteUserRepository : public UserRepository {
    sqlite3* db_;

public:
    explicit SQLiteUserRepository(sqlite3* db) : db_(db) {}

    // Call once after opening the database
    void initSchema() {
        const char* sql =
            "CREATE TABLE IF NOT EXISTS users ("
            "  username      TEXT    PRIMARY KEY,"
            "  password_hash INTEGER NOT NULL"
            ");";
        char* errmsg = nullptr;
        if (sqlite3_exec(db_, sql, nullptr, nullptr, &errmsg) != SQLITE_OK) {
            std::string msg = errmsg ? errmsg : "unknown error";
            sqlite3_free(errmsg);
            throw std::runtime_error("initSchema failed: " + msg);
        }
    }

    bool createUser(const User& user) override {
        const char* sql = "INSERT INTO users (username, password_hash) VALUES (?, ?);";
        sqlite3_stmt* stmt = nullptr;

        if (sqlite3_prepare_v2(db_, sql, -1, &stmt, nullptr) != SQLITE_OK)
            return false;

        sqlite3_bind_text(stmt,  1, user.username.c_str(), -1, SQLITE_TRANSIENT);
        sqlite3_bind_int64(stmt, 2, user.passwordHash);

        bool ok = (sqlite3_step(stmt) == SQLITE_DONE);
        sqlite3_finalize(stmt);
        return ok;
    }

    bool userExists(const std::string& username) override {
        const char* sql = "SELECT 1 FROM users WHERE username = ? LIMIT 1;";
        sqlite3_stmt* stmt = nullptr;

        if (sqlite3_prepare_v2(db_, sql, -1, &stmt, nullptr) != SQLITE_OK)
            return false;

        sqlite3_bind_text(stmt, 1, username.c_str(), -1, SQLITE_TRANSIENT);

        bool found = (sqlite3_step(stmt) == SQLITE_ROW);
        sqlite3_finalize(stmt);
        return found;
    }

    User findUser(const std::string& username) override {
        const char* sql = "SELECT username, password_hash FROM users WHERE username = ?;";
        sqlite3_stmt* stmt = nullptr;

        if (sqlite3_prepare_v2(db_, sql, -1, &stmt, nullptr) != SQLITE_OK)
            return {};

        sqlite3_bind_text(stmt, 1, username.c_str(), -1, SQLITE_TRANSIENT);

        User user;
        if (sqlite3_step(stmt) == SQLITE_ROW) {
            user.username     = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 0));
            user.passwordHash = sqlite3_column_int64(stmt, 1);
        }
        sqlite3_finalize(stmt);
        return user;
    }
};
