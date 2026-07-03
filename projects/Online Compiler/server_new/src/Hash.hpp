#pragma once
#include <string>

struct Hash {
    // Polynomial rolling hash.
    // Returns a long long so it can be stored without truncation.
    long long findHash(const std::string& s) const {
        const long long p = 31, m = 1'000'000'007LL;
        long long hashVal = 0, pPow = 1;
        for (char c : s) {
            hashVal = (hashVal + (c - 'a' + 1) * pPow) % m;
            pPow    = (pPow * p) % m;
        }
        return hashVal;
    }
};
