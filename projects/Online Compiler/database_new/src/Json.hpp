#pragma once
#include <map>
#include <string>
#include <cctype>

// ── Flat key-value JSON container ──────────────────────────────────────────
struct Json {
    std::map<std::string, std::string> values;
};

// ── Minimal JSON parser (string values only) ───────────────────────────────
struct JsonParser {

    Json parse(const std::string& s) const {
        Json json;
        size_t i = 0;

        skip(s, i);
        if (i < s.size() && s[i] == '{') ++i;

        while (i < s.size()) {
            skip(s, i);
            if (i >= s.size() || s[i] == '}') break;

            std::string key = parseString(s, i);

            skip(s, i);
            if (i < s.size() && s[i] == ':') ++i;
            skip(s, i);

            std::string value = parseString(s, i);
            json.values[key] = value;

            skip(s, i);
            if (i < s.size() && s[i] == ',') ++i;
        }
        return json;
    }

private:
    void skip(const std::string& s, size_t& i) const {
        while (i < s.size() && std::isspace(static_cast<unsigned char>(s[i])))
            ++i;
    }

    std::string parseString(const std::string& s, size_t& i) const {
        std::string result;
        if (i < s.size() && s[i] == '"') ++i;          // skip opening "
        while (i < s.size() && s[i] != '"') {
            if (s[i] == '\\' && i + 1 < s.size()) {    // handle escapes
                ++i;
                switch (s[i]) {
                    case '"':  result += '"';  break;
                    case '\\': result += '\\'; break;
                    case 'n':  result += '\n'; break;
                    case 't':  result += '\t'; break;
                    case 'r':  result += '\r'; break;
                    default:   result += s[i]; break;
                }
            } else {
                result += s[i];
            }
            ++i;
        }
        if (i < s.size() && s[i] == '"') ++i;          // skip closing "
        return result;
    }
};
