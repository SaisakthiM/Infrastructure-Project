#pragma once
#include <string>
#include <map>
#include <sstream>
#include "Base.hpp"

struct TableSchema {
    std::string tableName;
    std::map<std::string, std::string> columns;
};

struct SchemaParser {

    TableSchema parse(const BaseRequest& req) {
        TableSchema schema;
        schema.tableName = req.table_name;

        std::stringstream ss(req.columns);
        std::string columnDef;

        while (std::getline(ss, columnDef, ',')) {

            size_t pos = columnDef.find(':');

            if (pos == std::string::npos)
                continue;

            std::string name =
                columnDef.substr(0, pos);

            std::string type =
                columnDef.substr(pos + 1);

            schema.columns[name] = type;
        }

        return schema;
    }
};


struct SchemaJsonBuilder {

    std::string build(
        const TableSchema& schema)
    {
        std::string json;

        json += "{\n";
        json += "\"table_name\":\"";
        json += schema.tableName;
        json += "\",\n";

        json += "\"columns\":{\n";

        bool first = true;

        for (auto& [name, type] : schema.columns) {

            if (!first)
                json += ",\n";

            json += "\"" + name +
                    "\":\"" + type + "\"";

            first = false;
        }

        json += "\n},\n";

        json += "\"rows\":[]\n";
        json += "}";

        return json;
    }
};