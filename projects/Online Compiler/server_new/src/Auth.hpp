#pragma once
#include <string>

struct AuthRequest {
    std::string username;
    std::string password;
};

struct AuthResponse {
    bool        success = false;
    std::string message;
    std::string token;      // non-empty only on success
};
