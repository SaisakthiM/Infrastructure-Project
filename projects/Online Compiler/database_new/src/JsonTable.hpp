#pragma once
#include <string>
#include <map>
#include <vector>
#include <sstream>
#include <stdexcept>
#include <fstream>
#include "Json.hpp"
#include "Table.hpp"

// ── Supported column types ──────────────────────────────────────────────────
// int    → stored as JSON number, validated as integer
// float  → stored as JSON number, validated as floating point
// bool   → stored as JSON bool (true/false), accepts "true"/"false"/"1"/"0"
// string → stored as JSON string, no extra validation

// ── Type validator + JSON value formatter ───────────────────────────────────
struct TypedValue {
    // Returns the JSON-ready representation of `raw` for the given `type`.
    // Throws std::invalid_argument if validation fails.
    static std::string format(const std::string& type, const std::string& raw) {
        if (type == "int") {
            // must be all digits, optional leading minus
            size_t start = (raw[0] == '-') ? 1 : 0;
            for (size_t i = start; i < raw.size(); ++i)
                if (!std::isdigit((unsigned char)raw[i]))
                    throw std::invalid_argument(
                        "Expected int, got: \"" + raw + "\"");
            return raw; // bare number in JSON
        }
        if (type == "float") {
            bool hasDot = false;
            size_t start = (raw[0] == '-') ? 1 : 0;
            for (size_t i = start; i < raw.size(); ++i) {
                if (raw[i] == '.') { hasDot = true; continue; }
                if (!std::isdigit((unsigned char)raw[i]))
                    throw std::invalid_argument(
                        "Expected float, got: \"" + raw + "\"");
            }
            (void)hasDot;
            return raw; // bare number in JSON
        }
        if (type == "bool") {
            if (raw == "true"  || raw == "1") return "true";
            if (raw == "false" || raw == "0") return "false";
            throw std::invalid_argument(
                "Expected bool (true/false/1/0), got: \"" + raw + "\"");
        }
        // default → string
        // escape inner quotes
        std::string escaped;
        for (char c : raw) {
            if (c == '"')  escaped += "\\\"";
            else if (c == '\\') escaped += "\\\\";
            else escaped += c;
        }
        return "\"" + escaped + "\"";
    }
};

// ── Reads schema.json back into a TableSchema ───────────────────────────────
struct SchemaReader {
    // schema.json has the shape:
    //   { "table_name":"...", "columns":{"col":"type",...}, "rows":[] }
    // We do a simple hand-rolled parse since our JsonParser is flat only.
    TableSchema read(const std::string& table_path) {
        std::ifstream f(table_path + "/schema.json");
        std::string content, line;
        while (std::getline(f, line)) content += line;

        TableSchema schema;

        // table_name
        {
            size_t p = content.find("\"table_name\"");
            if (p != std::string::npos) {
                size_t q = content.find('"', p + 13);
                size_t r = content.find('"', q + 1);
                if (q != std::string::npos && r != std::string::npos)
                    schema.tableName = content.substr(q + 1, r - q - 1);
            }
        }

        // columns block: everything between "columns":{ and the matching }
        {
            size_t cols_start = content.find("\"columns\"");
            if (cols_start != std::string::npos) {
                size_t brace = content.find('{', cols_start);
                size_t brace_end = content.find('}', brace);
                if (brace != std::string::npos && brace_end != std::string::npos) {
                    std::string cols_block =
                        content.substr(brace + 1, brace_end - brace - 1);
                    // parse "name":"type" pairs
                    size_t i = 0;
                    while (i < cols_block.size()) {
                        size_t q1 = cols_block.find('"', i);
                        if (q1 == std::string::npos) break;
                        size_t q2 = cols_block.find('"', q1 + 1);
                        if (q2 == std::string::npos) break;
                        std::string col_name = cols_block.substr(q1 + 1, q2 - q1 - 1);

                        size_t colon = cols_block.find(':', q2);
                        if (colon == std::string::npos) break;
                        size_t q3 = cols_block.find('"', colon);
                        if (q3 == std::string::npos) break;
                        size_t q4 = cols_block.find('"', q3 + 1);
                        if (q4 == std::string::npos) break;
                        std::string col_type = cols_block.substr(q3 + 1, q4 - q3 - 1);

                        schema.columns[col_name] = col_type;
                        i = q4 + 1;
                        // skip optional comma
                        while (i < cols_block.size() &&
                               (cols_block[i] == ',' || std::isspace((unsigned char)cols_block[i])))
                            ++i;
                    }
                }
            }
        }
        return schema;
    }
};

// ── Builds a validated row JSON string from request data ────────────────────
// Request body must contain the column values as flat JSON keys alongside
// database_name and table_name.  Example:
//   { "database_name":"mydb", "table_name":"users",
//     "name":"Alice", "age":"30", "active":"true" }
struct RowBuilder {
    SchemaReader schemaReader;

    struct RowResult {
        bool        ok;
        std::string json;   // on success: the row JSON
        std::string error;  // on failure: human-readable message
    };

    RowResult build(const std::string& table_path,
                    const Json& request,
                    int id) {
        TableSchema schema = schemaReader.read(table_path);

        std::string json = "{\n  \"id\": " + std::to_string(id) + ",\n";
        bool first = true;

        for (auto& [col, type] : schema.columns) {
            auto it = request.values.find(col);
            if (it == request.values.end()) {
                return { false, "", "Missing column: " + col };
            }
            std::string formatted;
            try {
                formatted = TypedValue::format(type, it->second);
            } catch (std::invalid_argument& e) {
                return { false, "", "Type error on column '" + col + "': " + e.what() };
            }

            if (!first) json += ",\n";
            json += "  \"" + col + "\": " + formatted;
            first = false;
        }
        json += "\n}";
        return { true, json, "" };
    }
};
