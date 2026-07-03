
#include "Json.hpp"
#include <string>
#include <vector>
#pragma once

struct BaseRequest {
    
    std::string database_name;
    std::string table_name;
    std::string columns;
};
struct BaseResponse {
    bool status;
    std::string message;
};

struct ParseResult {
    BaseRequest request;
    BaseResponse response;
};

struct BaseParser {
    ParseResult baseParse(Json request) {
        auto database = request.values.find("database_name");
        auto table_name = request.values.find("table_name");
        auto colums = request.values.find("columns");

        if (database == request.values.end() or table_name == request.values.end() or colums == request.values.end()) {
            BaseResponse response;
            response.status = false;
            response.message = "Creation Failed. Give the correct parameters";
            BaseRequest final;
            ParseResult result;
            result.request = final;
            result.response = response;
            return result;
        }
        else {
            BaseResponse response;
            response.status = true;
            response.message = "Creating Database";
            BaseRequest final;
            final.database_name = database->second;
            final.table_name = table_name->second;
            final.columns = colums->second;
            
            ParseResult result;
            result.request = final;
            result.response = response;
            return result;
        }
    };
};