#pragma once
#include <string>
#include <random>
#include <unordered_map>

class SessionManager {
    std::unordered_map<std::string, std::string> sessions_;   // token → username

    std::string generateToken() const {
        static const std::string chars =
            "0123456789"
            "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
            "abcdefghijklmnopqrstuvwxyz";
        std::random_device              rd;
        std::mt19937                    gen(rd());
        std::uniform_int_distribution<> dist(0, static_cast<int>(chars.size()) - 1);
        std::string token;
        token.reserve(32);
        for (int i = 0; i < 32; ++i)
            token += chars[dist(gen)];
        return token;
    }

public:
    // Creates a session and returns the new token
    std::string createSession(const std::string& username) {
        std::string token = generateToken();
        sessions_[token]  = username;
        return token;
    }

    bool exists(const std::string& token) const {
        return sessions_.count(token) > 0;
    }

    // Returns "" if token is invalid
    std::string getUser(const std::string& token) const {
        auto it = sessions_.find(token);
        return it != sessions_.end() ? it->second : "";
    }

    void removeSession(const std::string& token) {
        sessions_.erase(token);
    }
    
};
