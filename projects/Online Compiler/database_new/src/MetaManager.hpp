
#include <string>
#include "Json.hpp"
#include <filesystem>
#include <fstream>

struct MetaManager {
    JsonParser jsonParser;
    int getNextId(const std::string& table_path) {
        std::ifstream file(table_path + "/_meta.json");

        std::string content;
        std::string line;

        while (std::getline(file, line)) {
            content += line;
        }

        Json meta =jsonParser.parse(content);

        return std::stoi(meta.values["next_id"]);
    }
    void setNextId(const std::string& table_path,int next_id) {
        std::ofstream file(table_path + "/_meta.json");

        file <<
            "{\n"
            "  \"next_id\": "
            << next_id
            << "\n"
            "}";
    }
};