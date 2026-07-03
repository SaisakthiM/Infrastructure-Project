#pragma once
#include <string>
#include <vector>
#include <map>
#include <fstream>
#include <filesystem>
#include <iostream>
#include <algorithm>

// ── Config ────────────────────────────────────────────────────────────────────
// A leaf node splits when it reaches ORDER entries.
// After a split the parent gains one promoted key.
static constexpr int BTREE_ORDER = 10;   // max entries per node before split

// ── Entry ─────────────────────────────────────────────────────────────────────
struct BEntry {
    int                               id = 0;
    std::map<std::string,std::string> fields;
};

// ── Serialisation ─────────────────────────────────────────────────────────────
namespace btree_io {

inline std::string esc(const std::string& s) {
    std::string o; o.reserve(s.size());
    for (char c : s) {
        if      (c == '|')  o += "\\|";
        else if (c == '\\') o += "\\\\";
        else                o += c;
    }
    return o;
}

inline std::string serialise(const BEntry& e) {
    std::string line = std::to_string(e.id);
    for (auto& [k,v] : e.fields)
        line += '|' + esc(k) + '=' + esc(v);
    return line;
}

inline BEntry parse(const std::string& line) {
    BEntry e;
    std::vector<std::string> parts;
    std::string cur;
    for (size_t i = 0; i < line.size(); ++i) {
        if (line[i]=='\\' && i+1 < line.size()) { cur += line[++i]; }
        else if (line[i]=='|')                  { parts.push_back(cur); cur.clear(); }
        else                                    { cur += line[i]; }
    }
    parts.push_back(cur);
    if (parts.empty()) return e;
    try { e.id = std::stoi(parts[0]); } catch(...) {}
    for (size_t i = 1; i < parts.size(); ++i) {
        auto eq = parts[i].find('=');
        if (eq == std::string::npos) continue;
        e.fields[parts[i].substr(0,eq)] = parts[i].substr(eq+1);
    }
    return e;
}

} // namespace btree_io

// ── Node ──────────────────────────────────────────────────────────────────────
struct BNode {
    bool                     isLeaf = true;
    std::vector<BEntry>      entries;       // sorted by id
    std::vector<std::string> childFiles;    // size = entries.size()+1 when internal
    std::string              filename;
};

// ── BTree ─────────────────────────────────────────────────────────────────────
// One BTree per table.  Tree files live at <table_path>/tree/*.tree
// root is always root.tree.
//
// Invariants maintained:
//   LEAF node    : 0..ORDER-1 entries, no children
//   INTERNAL node: N entries  → N+1 children
//   Split        : when a node would exceed ORDER-1 entries, split it and
//                  push the median up to the parent (or create a new root).
//
struct BTree {
    std::string treePath;

    // ── init ─────────────────────────────────────────────────────────────
    void init(const std::string& tablePath) {
        treePath = tablePath + "/tree";
        std::filesystem::create_directories(treePath);
        if (!std::filesystem::exists(treePath + "/root.tree")) {
            BNode root; root.isLeaf = true; root.filename = "root.tree";
            save(root);
            std::cout << "[BTREE] init " << treePath << "\n";
        }
    }

    // ── insert ────────────────────────────────────────────────────────────
    void insert(int id, const std::map<std::string,std::string>& fields) {
        BEntry e; e.id = id; e.fields = fields;
        auto [promoted, newChild] = insertDown("root.tree", e);
        // If the root split, create a new root above both halves
        if (!newChild.empty()) {
            BNode oldRoot = load("root.tree");
            BNode newRoot;
            newRoot.isLeaf = false;
            newRoot.filename = "root.tree";
            newRoot.entries.push_back(promoted);
            newRoot.childFiles.push_back(oldRoot.filename + ".old");
            newRoot.childFiles.push_back(newChild);
            // rename old root to a side node
            std::string sideName = freshName();
            std::filesystem::rename(treePath+"/root.tree",
                                    treePath+"/"+sideName);
            newRoot.childFiles[0] = sideName;
            save(newRoot);
            std::cout << "[BTREE] new root created after split\n";
        }
        std::cout << "[BTREE] inserted id=" << id << "\n";
    }

    // ── searchById ────────────────────────────────────────────────────────
    struct SearchResult { bool found; BEntry entry; };

    SearchResult searchById(int id) const {
        return searchDown(load("root.tree"), id);
    }

    // ── searchByField ─────────────────────────────────────────────────────
    std::vector<BEntry> searchByField(const std::string& field,
                                       const std::string& val) const {
        std::vector<BEntry> out;
        leafScan(load("root.tree"), field, val, out);
        return out;
    }

    // ── allEntries ────────────────────────────────────────────────────────
    std::vector<BEntry> allEntries() const {
        std::vector<BEntry> out;
        allLeaves(load("root.tree"), out);
        return out;
    }

    // ── dumpStructure ─────────────────────────────────────────────────────
    void dumpStructure() const { dumpNode(load("root.tree"), 0); }

private:
    // ── file I/O ──────────────────────────────────────────────────────────
    void save(const BNode& n) const {
        std::ofstream f(treePath + "/" + n.filename, std::ios::trunc);
        f << (n.isLeaf ? "LEAF" : "INTERNAL") << '\n'
          << n.entries.size() << '\n';
        for (auto& e : n.entries) f << btree_io::serialise(e) << '\n';
        f << n.childFiles.size() << '\n';
        for (auto& c : n.childFiles) f << c << '\n';
    }

    BNode load(const std::string& fname) const {
        BNode n; n.filename = fname;
        std::ifstream f(treePath + "/" + fname);
        if (!f) { n.isLeaf = true; return n; }
        std::string type; std::getline(f, type);
        n.isLeaf = (type == "LEAF");
        int ne = 0; f >> ne; f.ignore();
        for (int i = 0; i < ne; ++i) {
            std::string line; std::getline(f, line);
            if (!line.empty()) n.entries.push_back(btree_io::parse(line));
        }
        int nc = 0; f >> nc; f.ignore();
        for (int i = 0; i < nc; ++i) {
            std::string line; std::getline(f, line);
            if (!line.empty()) n.childFiles.push_back(line);
        }
        return n;
    }

    // generate a unique node filename
    std::string freshName() const {
        int count = 0;
        for (auto& p : std::filesystem::directory_iterator(treePath))
            if (p.path().extension() == ".tree") ++count;
        return "node_" + std::to_string(count) + ".tree";
    }

    // ── core recursive insert ─────────────────────────────────────────────
    // Returns {promotedEntry, newChildFilename}.
    // newChildFilename is empty when no split occurred.
    std::pair<BEntry,std::string> insertDown(const std::string& fname,
                                              const BEntry& e)
    {
        BNode node = load(fname);

        if (node.isLeaf) {
            // Insert sorted
            auto it = std::lower_bound(node.entries.begin(), node.entries.end(),
                                       e, [](auto& a, auto& b){ return a.id < b.id; });
            node.entries.insert(it, e);

            if ((int)node.entries.size() < BTREE_ORDER) {
                // No split needed
                save(node);
                return {{}, ""};
            }
            // Split leaf
            return splitLeaf(node);
        }

        // Internal node: find which child to descend into
        int ci = (int)node.entries.size(); // default: rightmost child
        for (int i = 0; i < (int)node.entries.size(); ++i) {
            if (e.id < node.entries[i].id) { ci = i; break; }
        }

        if (ci >= (int)node.childFiles.size()) {
            // Safety: clamp to last child
            ci = (int)node.childFiles.size() - 1;
        }

        auto [promoted, newChild] = insertDown(node.childFiles[ci], e);

        if (newChild.empty()) return {{}, ""}; // child did not split

        // Absorb promoted key + new child pointer into this node
        auto pit = std::lower_bound(node.entries.begin(), node.entries.end(),
                                    promoted, [](auto& a, auto& b){ return a.id < b.id; });
        int pos = (int)(pit - node.entries.begin());
        node.entries.insert(pit, promoted);
        node.childFiles.insert(node.childFiles.begin() + pos + 1, newChild);

        if ((int)node.entries.size() < BTREE_ORDER) {
            save(node);
            return {{}, ""};
        }
        // Split internal
        return splitInternal(node);
    }

    // ── split a full leaf ─────────────────────────────────────────────────
    // Left half stays in original file.  Right half goes to a new file.
    // Median (first key of right) is pushed up — both halves keep it:
    //   left  = entries[0 .. mid-1]
    //   right = entries[mid .. end]   (mid is also the promoted key)
    std::pair<BEntry,std::string> splitLeaf(BNode& node) {
        int mid = (int)node.entries.size() / 2;
        BEntry median = node.entries[mid];

        BNode right;
        right.isLeaf   = true;
        right.filename = freshName();
        right.entries.assign(node.entries.begin() + mid, node.entries.end());
        node.entries.resize(mid);

        save(node);
        save(right);

        std::cout << "[BTREE] leaf split → median id=" << median.id
                  << " left=" << node.filename << " right=" << right.filename << "\n";
        return {median, right.filename};
    }

    // ── split a full internal node ────────────────────────────────────────
    // Median is promoted (not kept in either child).
    //   left  = entries[0..mid-1]     children[0..mid]
    //   right = entries[mid+1..end]   children[mid+1..end]
    std::pair<BEntry,std::string> splitInternal(BNode& node) {
        int mid = (int)node.entries.size() / 2;
        BEntry median = node.entries[mid];

        BNode right;
        right.isLeaf   = false;
        right.filename = freshName();
        right.entries.assign(node.entries.begin() + mid + 1, node.entries.end());
        right.childFiles.assign(node.childFiles.begin() + mid + 1, node.childFiles.end());

        node.entries.resize(mid);
        node.childFiles.resize(mid + 1);

        save(node);
        save(right);

        std::cout << "[BTREE] internal split → median id=" << median.id
                  << " left=" << node.filename << " right=" << right.filename << "\n";
        return {median, right.filename};
    }

    // ── recursive id search ───────────────────────────────────────────────
    SearchResult searchDown(const BNode& node, int id) const {
        // Check entries in this node
        for (auto& e : node.entries)
            if (e.id == id) return {true, e};

        if (node.isLeaf) return {false, {}};

        // Descend to correct child
        int ci = (int)node.childFiles.size() - 1;
        for (int i = 0; i < (int)node.entries.size(); ++i) {
            if (id < node.entries[i].id) { ci = i; break; }
        }
        if (ci < (int)node.childFiles.size())
            return searchDown(load(node.childFiles[ci]), id);
        return {false, {}};
    }

    // ── full leaf scan ────────────────────────────────────────────────────
    void leafScan(const BNode& node,
                  const std::string& field,
                  const std::string& val,
                  std::vector<BEntry>& out) const
    {
        if (node.isLeaf) {
            for (auto& e : node.entries) {
                auto it = e.fields.find(field);
                if (it != e.fields.end() && it->second == val)
                    out.push_back(e);
            }
            return;
        }
        for (auto& c : node.childFiles)
            leafScan(load(c), field, val, out);
    }

    void allLeaves(const BNode& node, std::vector<BEntry>& out) const {
        if (node.isLeaf) { for (auto& e : node.entries) out.push_back(e); return; }
        for (auto& c : node.childFiles) allLeaves(load(c), out);
    }

    void dumpNode(const BNode& n, int d) const {
        std::string indent(d*2,' ');
        std::cout << indent << (n.isLeaf?"LEAF":"INTERNAL")
                  << "[" << n.filename << "] ids:";
        for (auto& e : n.entries) std::cout << e.id << " ";
        std::cout << "  children:" << n.childFiles.size() << "\n";
        for (auto& c : n.childFiles) dumpNode(load(c), d+1);
    }
};
