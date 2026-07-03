#pragma once
#include <thread>
#include <mutex>
#include <condition_variable>
#include <queue>
#include <functional>
#include <vector>
#include <atomic>
#include <iostream>

// ── ThreadPool ────────────────────────────────────────────────────────────────
// Fixed-size pool of worker threads.  Tasks are std::function<void()> pushed
// onto a shared queue; workers pick them up as they become free.
//
// Usage:
//   ThreadPool pool(4);
//   pool.submit([fd, &handler]{ handler.handle(fd); });
//
struct ThreadPool {
    explicit ThreadPool(int numThreads) : stop_(false) {
        for (int i = 0; i < numThreads; ++i) {
            workers_.emplace_back([this, i] {
                std::cout << "[pool] worker " << i << " ready\n";
                while (true) {
                    std::function<void()> task;
                    {
                        std::unique_lock<std::mutex> lock(mutex_);
                        cv_.wait(lock, [this]{
                            return stop_ || !tasks_.empty();
                        });
                        if (stop_ && tasks_.empty()) return;
                        task = std::move(tasks_.front());
                        tasks_.pop();
                    }
                    task();
                }
            });
        }
    }

    // Submit a callable — returns immediately, runs on next free worker
    void submit(std::function<void()> task) {
        {
            std::lock_guard<std::mutex> lock(mutex_);
            tasks_.push(std::move(task));
        }
        cv_.notify_one();
    }

    ~ThreadPool() {
        {
            std::lock_guard<std::mutex> lock(mutex_);
            stop_ = true;
        }
        cv_.notify_all();
        for (auto& t : workers_) t.join();
    }

private:
    std::vector<std::thread>          workers_;
    std::queue<std::function<void()>> tasks_;
    std::mutex                        mutex_;
    std::condition_variable           cv_;
    std::atomic<bool>                 stop_;
};
