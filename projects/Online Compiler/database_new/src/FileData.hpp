#pragma once
#include "Interface.hpp"
#include "Json.hpp"
#include "Table.hpp"
#include "JsonTable.hpp"
#include "Base.hpp"
#include "MetaManager.hpp"
#include "BTree.hpp"
#include <fstream>
#include <filesystem>
#include <string>
#include <iostream>
#include <map>

// ── BTree registry: one BTree instance per table path ───────────────────────
struct BTreeRegistry {
    std::map<std::string, BTree> trees;

    BTree& get(const std::string& table_path) {
        auto it = trees.find(table_path);
        if (it != trees.end()) return it->second;
        BTree& bt = trees[table_path];
        bt.init(table_path);
        return bt;
    }
};

struct FileData {
    SchemaParser      schemaParser;
    SchemaJsonBuilder schemaBuilder;
    BaseParser        baseParser;
    RowBuilder        rowBuilder;
    MetaManager       manager;
    BTreeRegistry     btReg;

    // ── POST /create ─────────────────────────────────────────────────────
    std::string handleCreate(const Json& request) {
        ParseResult result = baseParser.baseParse(request);
        if (!result.response.status)
            return errorJson(result.response.message);

        TableSchema schema     = schemaParser.parse(result.request);
        std::string schemaJson = schemaBuilder.build(schema);

        std::string table_path =
            "data/" + result.request.database_name +
            "/" + result.request.table_name;

        std::filesystem::create_directories(table_path);

        // schema.json
        { std::ofstream f(table_path + "/schema.json"); f << schemaJson; }
        // _meta.json
        { std::ofstream f(table_path + "/_meta.json"); f << "{\n  \"next_id\": 1\n}"; }

        // initialise BTree for this table
        btReg.get(table_path);

        std::cout << "[CREATE] " << table_path << "\n";
        return "{\"status\":true,\"message\":\"Table created\","
               "\"table\":\"" + result.request.table_name + "\"}";
    }

    // ── POST /insert ──────────────────────────────────────────────────────
    std::string handleInsert(const Json& request) {
        auto db = request.values.find("database_name");
        auto tb = request.values.find("table_name");
        if (db == request.values.end() || tb == request.values.end())
            return errorJson("Missing database_name or table_name");

        std::string table_path = "data/" + db->second + "/" + tb->second;
        if (!std::filesystem::exists(table_path))
            return errorJson("Table does not exist: " + tb->second);

        int id = manager.getNextId(table_path);

        RowBuilder::RowResult row = rowBuilder.build(table_path, request, id);
        if (!row.ok) return errorJson(row.error);

        // ── 1. Write JSON file (original storage) ────────────────────────
        std::string row_path = table_path + "/" + std::to_string(id) + ".json";
        { std::ofstream f(row_path); f << row.json; }
        manager.setNextId(table_path, id + 1);

        // ── 2. Also insert into BTree ─────────────────────────────────────
        // Build field map from request (skip meta keys)
        std::map<std::string, std::string> fields;
        for (auto& [k, v] : request.values) {
            if (k != "database_name" && k != "table_name")
                fields[k] = v;
        }
        btReg.get(table_path).insert(id, fields);

        std::cout << "[INSERT] id=" << id << " → " << row_path << "\n";
        return "{\"status\":true,\"message\":\"Row inserted\",\"id\":" +
               std::to_string(id) + "}";
    }

    // ── GET /search?database_name=x&table_name=y&id=N ────────────────────
    // Primary: try BTree first; if not found fall back to file.
    std::string handleSearch(const Json& query) {
        auto db = query.values.find("database_name");
        auto tb = query.values.find("table_name");
        auto id = query.values.find("id");

        if (db == query.values.end() || tb == query.values.end() || id == query.values.end())
            return errorJson("Missing database_name, table_name, or id");

        std::string table_path = "data/" + db->second + "/" + tb->second;
        int rid = std::stoi(id->second);

        // ── Try BTree lookup ──────────────────────────────────────────────
        BTree& bt = btReg.get(table_path);
        auto res  = bt.searchById(rid);
        if (res.found) {
            std::cout << "[SEARCH/BTREE] id=" << rid << "\n";
            return "{\"status\":true,\"source\":\"btree\",\"data\":"
                   + bEntryToJson(res.entry) + "}";
        }

        // ── Fallback: file ────────────────────────────────────────────────
        std::string file_path = table_path + "/" + id->second + ".json";
        std::ifstream f(file_path);
        if (!f.is_open())
            return errorJson("Row not found: id=" + id->second);

        std::string content, line;
        while (std::getline(f, line)) content += line + "\n";

        std::cout << "[SEARCH/FILE] id=" << rid << "\n";
        return "{\"status\":true,\"source\":\"file\",\"data\":" + content + "}";
    }

    // ── GET /field_search?database_name=x&table_name=y&field=name&value=Alice ──
    std::string handleFieldSearch(const Json& query) {
        auto db    = query.values.find("database_name");
        auto tb    = query.values.find("table_name");
        auto field = query.values.find("field");
        auto value = query.values.find("value");

        if (db == query.values.end() || tb == query.values.end() ||
            field == query.values.end() || value == query.values.end())
            return errorJson("Missing database_name, table_name, field, or value");

        std::string table_path = "data/" + db->second + "/" + tb->second;
        if (!std::filesystem::exists(table_path))
            return errorJson("Table does not exist: " + tb->second);

        BTree& bt = btReg.get(table_path);
        auto matches = bt.searchByField(field->second, value->second);

        std::cout << "[FIELD_SEARCH] " << field->second << "="
                  << value->second << " → " << matches.size() << " matches\n";

        // Build JSON array
        std::string arr = "[";
        bool first = true;
        for (auto& e : matches) {
            if (!first) arr += ",";
            arr += bEntryToJson(e);
            first = false;
        }
        arr += "]";

        return "{\"status\":true,\"count\":" + std::to_string(matches.size()) +
               ",\"data\":" + arr + "}";
    }

private:
    // Convert a BEntry to a JSON object string
    static std::string bEntryToJson(const BEntry& e) {
        std::string j = "{\"id\":" + std::to_string(e.id);
        for (auto& [k, v] : e.fields) {
            j += ",\"" + k + "\":\"" + escapeStr(v) + "\"";
        }
        j += "}";
        return j;
    }

    static std::string escapeStr(const std::string& s) {
        std::string out;
        for (char c : s) {
            if (c == '"')  out += "\\\"";
            else if (c == '\\') out += "\\\\";
            else out += c;
        }
        return out;
    }

    static std::string errorJson(const std::string& msg) {
        std::string e;
        for (char c : msg) {
            if (c == '"') e += "\\\"";
            else e += c;
        }
        return "{\"status\":false,\"message\":\"" + e + "\"}";
    }
};
