#pragma once
#include <string>
#include <cstdio>
#include <stdexcept>
#include <fstream>
#include <cstdlib>

// Runs user code in a temporary file via the system shell.
// Only Python and C (compiled with gcc) are supported out of the box.
// Add more languages by extending runCode().
//
// ⚠ Security note: this is an educational implementation.
//   For production, sandbox with Docker/nsjail/seccomp and set resource limits.

struct CodeRunner {

    struct Result {
        std::string output;
        int         exitCode = 0;
    };

    Result runCode(const std::string& language,
                   const std::string& code) const
    {
        if (language == "python")   return runPython(code);
        if (language == "c")        return runC(code);
        if (language == "cpp")      return runCpp(code);
        if (language == "bash")     return runBash(code);
        return { "unsupported language: " + language, 1 };
    }

private:
    // ── helpers ─────────────────────────────────────────────────────────────

    std::string tmpFile(const std::string& ext) const {
        return "/tmp/code_" + std::to_string(std::rand()) + ext;
    }

    // Runs a shell command, captures stdout + stderr, returns output + exit code
    Result exec(const std::string& cmd) const {
        FILE* pipe = popen((cmd + " 2>&1").c_str(), "r");
        if (!pipe) return { "failed to start process", 1 };

        char   buf[256];
        std::string out;
        while (fgets(buf, sizeof(buf), pipe))
            out += buf;

        int status = pclose(pipe);
        int code   = WIFEXITED(status) ? WEXITSTATUS(status) : 1;

        // Trim trailing newline for cleaner JSON
        while (!out.empty() && (out.back() == '\n' || out.back() == '\r'))
            out.pop_back();

        return { out, code };
    }

    void writeFile(const std::string& path, const std::string& content) const {
        std::ofstream f(path);
        if (!f) throw std::runtime_error("cannot create temp file: " + path);
        f << content;
    }

    // ── language runners ─────────────────────────────────────────────────────

    Result runPython(const std::string& code) const {
        std::string src = tmpFile(".py");
        writeFile(src, code);
        Result r = exec("timeout 10 python3 " + src);
        std::remove(src.c_str());
        return r;
    }

    Result runC(const std::string& code) const {
        std::string src = tmpFile(".c");
        std::string bin = tmpFile("");
        writeFile(src, code);
        Result compile = exec("gcc -o " + bin + " " + src);
        if (compile.exitCode != 0) {
            std::remove(src.c_str());
            return { "Compile error:\n" + compile.output, compile.exitCode };
        }
        Result run = exec("timeout 10 " + bin);
        std::remove(src.c_str());
        std::remove(bin.c_str());
        return run;
    }

    Result runCpp(const std::string& code) const {
        std::string src = tmpFile(".cpp");
        std::string bin = tmpFile("");
        writeFile(src, code);
        Result compile = exec("g++ -std=c++17 -o " + bin + " " + src);
        if (compile.exitCode != 0) {
            std::remove(src.c_str());
            return { "Compile error:\n" + compile.output, compile.exitCode };
        }
        Result run = exec("timeout 10 " + bin);
        std::remove(src.c_str());
        std::remove(bin.c_str());
        return run;
    }

    Result runBash(const std::string& code) const {
        std::string src = tmpFile(".sh");
        writeFile(src, code);
        Result r = exec("timeout 10 bash " + src);
        std::remove(src.c_str());
        return r;
    }
};
