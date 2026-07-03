#pragma once
#include <string>

struct User {
    std::string username;
    long long   passwordHash;   // matches Hash::findHash return type
};
