#pragma once
#include "Hash.hpp"
#include "Auth.hpp"
#include "User.hpp"
#include "UserRepository.hpp"
#include "SessionManager.hpp"

class AuthService {
    UserRepository&  repo_;
    SessionManager&  sessions_;
    Hash             hash_;

public:
    AuthService(UserRepository& repo, SessionManager& sessions)
        : repo_(repo), sessions_(sessions) {}

    AuthResponse registerUser(const AuthRequest& req) {
        if (req.username.empty() || req.password.empty())
            return { false, "username and password are required", "" };

        if (repo_.userExists(req.username))
            return { false, "username already taken", "" };

        User user{ req.username, hash_.findHash(req.password) };

        if (!repo_.createUser(user))
            return { false, "database error", "" };

        std::string token = sessions_.createSession(req.username);
        return { true, "user created", token };
    }

    AuthResponse login(const AuthRequest& req) {
        if (!repo_.userExists(req.username))
            return { false, "invalid username or password", "" };

        User stored = repo_.findUser(req.username);

        if (stored.passwordHash != hash_.findHash(req.password))
            return { false, "invalid username or password", "" };

        std::string token = sessions_.createSession(req.username);
        return { true, "login successful", token };
    }
};
