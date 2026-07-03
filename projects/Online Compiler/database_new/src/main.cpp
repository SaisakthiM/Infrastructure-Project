#include "Interface.hpp"
#include "FileData.hpp"
#include "ThreadPool.hpp"
#include <iostream>
#include <filesystem>
#include <mutex>

// ── Per-connection handler ────────────────────────────────────────────────────
static void handleClient(int clientFd,
                          FileData&   db,
                          std::mutex& dbMutex)
{
    Interface iface;
    iface.clientSocket = clientFd;

    HttpRequest req = iface.readRequest();
    
    std::cout << "[thread " << std::this_thread::get_id() << "] "
              << req.method << " " << req.path << "\n";


    Route r = Interface::route(req);
    std::string response;
    
    {
        // Lock for the duration of the DB operation (BTree + file I/O)
        std::lock_guard<std::mutex> lock(dbMutex);

        switch (r) {
            case Route::CREATE: {
                Json body = iface.parseBody(req);
                response  = db.handleCreate(body);
                break;
            }
            case Route::INSERT: {
                Json body = iface.parseBody(req);
                response  = db.handleInsert(body);
                break;
            }
            case Route::SEARCH: {
                Json query = iface.parseQuery(req);
                response   = db.handleSearch(query);
                break;
            }
            case Route::FIELD_SEARCH: {
                Json query = iface.parseQuery(req);
                response   = db.handleFieldSearch(query);
                break;
            }
            case Route::UNKNOWN: {
                response = "";   // send error below
                break;
            }
        }
    }

    iface.sendOk(response); // Ensure sendOk sends CORS headers (see Step 2)

    iface.closeClient();
}

int main() {
    std::filesystem::create_directories("data");

    FileData   db;
    std::mutex dbMutex;

    Interface   listener;
    ThreadPool  pool(4);

    listener.startConnection();
    std::cout << "[info] 4-thread pool running\n";

    while (true) {
        listener.acceptConnection();
        int fd = listener.clientSocket;
        listener.clientSocket = -1;

        pool.submit([fd, &db, &dbMutex]{
            handleClient(fd, db, dbMutex);
        });
    }

    return 0;
}