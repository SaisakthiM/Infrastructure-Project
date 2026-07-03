import { useState, useEffect, useContext, createContext, useCallback, useRef } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import {
  Play, Clock, LogOut, Terminal, CheckCircle, XCircle,
  Loader2, Search, X, AlertCircle, ChevronRight,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type AuthCtx = {
  user: string | null;
  token: string | null;
  loading: boolean;
  login: (u: string, t: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
};

type HistoryItem = {
  language: string;
  code: string;
  output: string;
  exitCode: number;
  exit_code?: number;
  timestamp: string;
};

// ─── API ──────────────────────────────────────────────────────────────────────

const API_URL = (import.meta as any).env?.VITE_API_URL ?? "http://localhost:9090";

async function apiFetch(method: string, path: string, body?: unknown, token?: string | null) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message ?? data.error ?? "Request failed");
  return data;
}

// ─── Auth Context ─────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthCtx | null>(null);

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = localStorage.getItem("token");
    const u = localStorage.getItem("user");
    if (t && u) { setToken(t); setUser(u); }
    setLoading(false);
  }, []);

  const login = (u: string, t: string) => {
    setUser(u); setToken(t);
    localStorage.setItem("user", u);
    localStorage.setItem("token", t);
  };

  const logout = () => {
    setUser(null); setToken(null);
    localStorage.removeItem("user");
    localStorage.removeItem("token");
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

function useAuth(): AuthCtx {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}

// ─── Language config ──────────────────────────────────────────────────────────

const LANGUAGES = [
  { id: "python",     name: "Python",     ext: "py",   dot: "#3b82f6", starter: 'print("Hello, World!")' },
  { id: "javascript", name: "JavaScript", ext: "js",   dot: "#f59e0b", starter: 'console.log("Hello, World!");' },
  { id: "cpp",        name: "C++",        ext: "cpp",  dot: "#8b5cf6", starter: '#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello, World!" << endl;\n    return 0;\n}' },
  { id: "c",          name: "C",          ext: "c",    dot: "#6366f1", starter: '#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}' },
  { id: "java",       name: "Java",       ext: "java", dot: "#ef4444", starter: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}' },
  { id: "golang",     name: "Go",         ext: "go",   dot: "#06b6d4", starter: 'package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, World!")\n}' },
];

// ─── Login Page ───────────────────────────────────────────────────────────────

function LoginPage() {
  const { login } = useAuth();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!username.trim() || !password.trim()) { setError("Username and password are required"); return; }
    setSubmitting(true);
    try {
      if (tab === "register") {
        await apiFetch("POST", "/register", { username, password });
        setSuccess("Account created — sign in now.");
        setTab("login");
        setPassword("");
      } else {
        const data = await apiFetch("POST", "/login", { username, password });
        login(username, data.token ?? data.access_token ?? data.jwt);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const switchTab = (t: "login" | "register") => { setTab(t); setError(""); setSuccess(""); };

  return (
    <div
      className="min-h-screen bg-background flex"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {/* ── Left panel ── */}
      <div className="hidden lg:flex lg:w-[52%] relative overflow-hidden flex-col justify-between p-14">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(rgba(34,211,238,0.025) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(34,211,238,0.025) 1px, transparent 1px)`,
            backgroundSize: "52px 52px",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/[0.04] via-transparent to-violet-600/[0.04] pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-background to-transparent pointer-events-none" />

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/[0.18] flex items-center justify-center">
            <Terminal className="w-4.5 h-4.5 text-cyan-400" strokeWidth={1.5} />
          </div>
          <span className="text-foreground font-bold tracking-tight">CodeFlow</span>
        </div>

        {/* Hero copy */}
        <div className="relative space-y-10">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-cyan-500/[0.18] bg-cyan-500/[0.05] text-cyan-400 text-xs font-semibold tracking-wider uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              Online Compiler
            </div>
            <h1 className="text-5xl font-bold text-foreground leading-[1.1] tracking-tight">
              Write. Run.<br />
              <span className="text-cyan-400">Iterate fast.</span>
            </h1>
            <p className="text-muted-foreground text-base leading-relaxed max-w-xs">
              Execute code across 6 languages instantly. No local setup — just open and code.
            </p>
          </div>

          {/* Language pills */}
          <div className="flex flex-wrap gap-2">
            {LANGUAGES.map(l => (
              <div
                key={l.id}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/[0.05] bg-white/[0.02] text-xs font-mono text-muted-foreground hover:border-white/[0.09] transition-colors"
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: l.dot }} />
                {l.name}
              </div>
            ))}
          </div>

          {/* Mini terminal preview */}
          <div className="rounded-xl border border-white/[0.06] bg-card overflow-hidden shadow-2xl">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.05] bg-[#0a0e1c]">
              <div className="flex gap-1.5">
                <span className="w-3 h-3 rounded-full bg-[#ff5f56]" />
                <span className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
                <span className="w-3 h-3 rounded-full bg-[#27c93f]" />
              </div>
              <span className="text-xs text-muted-foreground font-mono ml-2 opacity-60">main.py</span>
            </div>
            <div className="p-5 font-mono text-xs leading-6 space-y-0.5">
              <div>
                <span className="text-violet-400">def</span>
                <span className="text-cyan-300"> greet</span>
                <span className="text-foreground/70">(name):</span>
              </div>
              <div className="pl-4">
                <span className="text-violet-400">return</span>
                <span className="text-green-400"> f</span>
                <span className="text-green-400">"Hello, </span>
                <span className="text-cyan-300">{"{"}</span>
                <span className="text-foreground/80">name</span>
                <span className="text-cyan-300">{"}"}</span>
                <span className="text-green-400">!"</span>
              </div>
              <div className="mt-2">
                <span className="text-violet-400">print</span>
                <span className="text-foreground/70">(greet(</span>
                <span className="text-green-400">"CodeFlow"</span>
                <span className="text-foreground/70">))</span>
              </div>
              <div className="mt-3 pt-3 border-t border-white/[0.05]">
                <span className="text-cyan-400">$ </span>
                <span className="text-green-300">Hello, CodeFlow!</span>
              </div>
            </div>
          </div>
        </div>

        <div className="relative text-xs text-muted-foreground/50 font-mono">
          Fast execution · Execution history · 6 languages
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex items-center justify-center p-8 lg:border-l lg:border-white/[0.04]">
        <div className="w-full max-w-[360px]">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-10">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <Terminal className="w-4 h-4 text-cyan-400" strokeWidth={1.5} />
            </div>
            <span className="font-bold text-foreground">CodeFlow</span>
          </div>

          <div className="space-y-7">
            <div>
              <h2 className="text-2xl font-bold text-foreground tracking-tight">
                {tab === "login" ? "Welcome back" : "Create account"}
              </h2>
              <p className="text-muted-foreground text-sm mt-1.5">
                {tab === "login" ? "Sign in to your workspace" : "Start coding in seconds"}
              </p>
            </div>

            {/* Tab switcher */}
            <div className="flex gap-1 p-1 rounded-lg bg-card border border-border">
              {(["login", "register"] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => switchTab(t)}
                  className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all duration-150 ${
                    tab === t
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t === "login" ? "Sign In" : "Register"}
                </button>
              ))}
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2.5 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}
              {success && (
                <div className="flex items-center gap-2.5 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  {success}
                </div>
              )}

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-foreground">Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="your_username"
                    autoComplete="username"
                    className="w-full px-3.5 py-2.5 rounded-lg bg-card border border-border text-foreground placeholder:text-muted-foreground/50 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-foreground">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete={tab === "login" ? "current-password" : "new-password"}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-card border border-border text-foreground placeholder:text-muted-foreground/50 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/40 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-primary-foreground font-bold text-sm hover:brightness-110 disabled:opacity-50 transition-all"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {submitting ? "Please wait…" : tab === "login" ? "Sign In" : "Create Account"}
              </button>
            </form>

            <p className="text-center text-xs text-muted-foreground">
              {tab === "login" ? "No account? " : "Already have one? "}
              <button
                type="button"
                onClick={() => switchTab(tab === "login" ? "register" : "login")}
                className="text-cyan-400 hover:text-cyan-300 font-semibold transition-colors"
              >
                {tab === "login" ? "Register free" : "Sign in"}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Code Editor ──────────────────────────────────────────────────────────────

function CodeEditor({ code, onChange, disabled, language }: {
  code: string;
  onChange: (v: string) => void;
  disabled: boolean;
  language: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const lines = code.split("\n");
  const lang = LANGUAGES.find(l => l.id === language)!;

  const syncScroll = () => {
    if (gutterRef.current && textareaRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Tab") return;
    e.preventDefault();
    const el = textareaRef.current!;
    const s = el.selectionStart, en = el.selectionEnd;
    const next = code.substring(0, s) + "    " + code.substring(en);
    onChange(next);
    requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = s + 4; });
  };

  return (
    <div
      className="flex flex-col h-full bg-[#080b14]"
      style={{ fontFamily: "'JetBrains Mono', monospace" }}
    >
      {/* File tab */}
      <div className="flex items-center border-b border-white/[0.06] bg-[#0b0f1d] shrink-0">
        <div className="flex items-center gap-2 px-4 py-2.5 border-r border-white/[0.06] border-b-[1.5px] border-b-cyan-400 -mb-px">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: lang.dot }} />
          <span className="text-xs text-foreground/80">main.{lang.ext}</span>
        </div>
        <div className="flex-1" />
      </div>

      {/* Editor body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Gutter */}
        <div
          ref={gutterRef}
          className="shrink-0 w-[52px] select-none py-4 text-right pr-4 leading-6 text-xs overflow-hidden bg-[#080b14]"
          style={{
            color: "rgba(90,100,120,0.5)",
            scrollbarWidth: "none",
          }}
        >
          {lines.map((_, i) => <div key={i}>{i + 1}</div>)}
        </div>

        {/* Divider */}
        <div className="w-px bg-white/[0.04] shrink-0 my-4" />

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={code}
          onChange={e => onChange(e.target.value)}
          onScroll={syncScroll}
          onKeyDown={onKeyDown}
          disabled={disabled}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          className="flex-1 bg-[#080b14] text-foreground/85 py-4 px-3 resize-none focus:outline-none disabled:opacity-50 leading-6 text-sm caret-cyan-400"
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            scrollbarWidth: "thin",
            scrollbarColor: "rgba(255,255,255,0.07) transparent",
            tabSize: 4,
          }}
        />
      </div>
    </div>
  );
}

// ─── Output Panel ─────────────────────────────────────────────────────────────

function OutputPanel({ output, exitCode, loading, error, execTime }: {
  output: string;
  exitCode: number | null;
  loading: boolean;
  error: string;
  execTime: number | null;
}) {
  const success = exitCode === 0;

  return (
    <div className="flex flex-col h-full bg-[#060910]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06] bg-[#0b0f1d] shrink-0">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-muted-foreground/60" strokeWidth={1.5} />
          <span className="text-xs font-semibold tracking-wider text-muted-foreground/60 uppercase">Output</span>
        </div>
        <div className="flex items-center gap-2.5">
          {execTime !== null && !loading && (
            <span className="text-xs text-muted-foreground/40">{execTime}ms</span>
          )}
          {exitCode !== null && !loading && (
            <div className={`flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full border font-mono ${
              success
                ? "bg-green-500/8 text-green-400 border-green-500/20"
                : "bg-red-500/8 text-red-400 border-red-500/20"
            }`}>
              {success ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
              exit {exitCode}
            </div>
          )}
        </div>
      </div>

      {/* Terminal body */}
      <div
        className="flex-1 overflow-y-auto p-5"
        style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.06) transparent" }}
      >
        {loading ? (
          <div className="flex items-center gap-3 text-muted-foreground/60">
            <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
            <span className="text-sm">Executing…</span>
          </div>
        ) : error ? (
          <div>
            <div className="text-xs text-muted-foreground/40 mb-3 flex items-center gap-2">
              <span className="text-red-400">stderr</span>
            </div>
            <pre className="text-red-400/90 text-sm whitespace-pre-wrap break-words leading-6">{error}</pre>
          </div>
        ) : output ? (
          <div>
            <div className="flex items-center gap-2 mb-4 text-xs text-muted-foreground/40">
              <span className="text-cyan-400">$</span>
              <span>stdout</span>
            </div>
            <pre className="text-foreground/80 text-sm whitespace-pre-wrap break-words leading-6">{output}</pre>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 select-none">
            <Terminal className="w-9 h-9 text-muted-foreground/15" strokeWidth={1} />
            <div className="text-center">
              <p className="text-sm text-muted-foreground/30">No output yet</p>
              <p className="text-xs text-muted-foreground/20 mt-1">Press Run to execute your code</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── History Modal ─────────────────────────────────────────────────────────────

function HistoryModal({ history, onSelect, onClose }: {
  history: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const filtered = history.filter(h =>
    h.language.toLowerCase().includes(search.toLowerCase()) ||
    h.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-[2px] flex items-center justify-center z-50 p-4"
      onClick={onClose}
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      <div
        className="w-full max-w-2xl max-h-[72vh] flex flex-col rounded-2xl border border-white/[0.07] bg-card shadow-[0_32px_80px_rgba(0,0,0,0.7)]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.05]">
          <div className="flex items-center gap-3">
            <Clock className="w-4 h-4 text-cyan-400" strokeWidth={1.5} />
            <h3 className="font-bold text-foreground text-sm">Execution History</h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-white/[0.04] text-muted-foreground border border-white/[0.05]">
              {history.length} runs
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/[0.05] transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-white/[0.04]">
          <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] focus-within:border-cyan-500/25 transition-colors">
            <Search className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by language or code…"
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            />
          </div>
        </div>

        {/* List */}
        <div
          className="flex-1 overflow-y-auto p-3 space-y-1"
          style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.06) transparent" }}
        >
          {filtered.length === 0 ? (
            <div className="text-center text-muted-foreground/40 py-14 text-sm">No results found</div>
          ) : (
            filtered.map((item, i) => {
              const lang = LANGUAGES.find(l => l.id === item.language);
              const exitC = item.exitCode ?? item.exit_code ?? 0;
              return (
                <button
                  key={i}
                  onClick={() => { onSelect(item); onClose(); }}
                  className="w-full text-left px-4 py-3.5 rounded-xl border border-transparent hover:border-white/[0.05] hover:bg-white/[0.025] transition-all group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: lang?.dot ?? "#22d3ee" }} />
                        <span className="text-xs font-bold text-foreground" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                          {lang?.name ?? item.language}
                        </span>
                      </div>
                      <p
                        className="text-xs text-muted-foreground/60 truncate"
                        style={{ fontFamily: "'JetBrains Mono', monospace" }}
                      >
                        {item.code.split("\n")[0]}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${
                        exitC === 0 ? "bg-green-500/8 text-green-400" : "bg-red-500/8 text-red-400"
                      }`}>
                        {exitC === 0 ? "success" : "error"}
                      </span>
                      <span className="text-xs text-muted-foreground/35">
                        {new Date(item.timestamp).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Editor Page ──────────────────────────────────────────────────────────────

function EditorPage() {
  const { user, token, logout } = useAuth();
  const [language, setLanguage] = useState("python");
  const [code, setCode] = useState(LANGUAGES[0].starter);
  const [output, setOutput] = useState("");
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [execTime, setExecTime] = useState<number | null>(null);
  const [outputError, setOutputError] = useState("");
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const fetchHistory = useCallback(async () => {
    try {
      const data = await apiFetch("GET", "/history", undefined, token);
      setHistory(Array.isArray(data) ? data : data.history ?? []);
    } catch {}
  }, [token]);

  const runCode = async () => {
    if (!token || !code.trim()) return;
    setRunning(true);
    setOutput(""); setOutputError(""); setExitCode(null); setExecTime(null);
    const t0 = Date.now();
    try {
      const data = await apiFetch("POST", "/code", { language, code }, token);
      setOutput(data.output ?? data.stdout ?? "");
      setExitCode(data.exit_code ?? data.exitCode ?? 0);
      setExecTime(Date.now() - t0);
      if (data.stderr) setOutputError(data.stderr);
    } catch (err: any) {
      setOutputError(err.message);
      setExitCode(1);
      setExecTime(Date.now() - t0);
    } finally {
      setRunning(false);
    }
  };

  const switchLang = (id: string) => {
    setLanguage(id);
    const lang = LANGUAGES.find(l => l.id === id)!;
    setCode(lang.starter);
    setOutput(""); setOutputError(""); setExitCode(null); setExecTime(null);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); runCode(); }
  };

  const activeLang = LANGUAGES.find(l => l.id === language)!;

  return (
    <div
      className="h-screen flex flex-col bg-background overflow-hidden"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      onKeyDown={onKeyDown}
    >
      {/* ── Navbar ── */}
      <header className="flex items-center gap-3 px-4 py-2 border-b border-white/[0.05] bg-[#0b0f1d] shrink-0 z-10">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mr-3 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/[0.18] flex items-center justify-center">
            <Terminal className="w-3.5 h-3.5 text-cyan-400" strokeWidth={1.5} />
          </div>
          <span className="text-sm font-bold text-foreground hidden sm:block tracking-tight">CodeFlow</span>
        </div>

        <div className="w-px h-5 bg-white/[0.06] shrink-0 hidden sm:block" />

        {/* Language selector */}
        <div
          className="flex items-center gap-0.5 flex-1 overflow-x-auto"
          style={{ scrollbarWidth: "none" }}
        >
          {LANGUAGES.map(lang => (
            <button
              key={lang.id}
              onClick={() => switchLang(lang.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all duration-100 ${
                language === lang.id
                  ? "bg-white/[0.07] text-foreground"
                  : "text-muted-foreground hover:text-foreground/70 hover:bg-white/[0.03]"
              }`}
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: lang.dot }} />
              {lang.name}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0 ml-2">
          {/* Keyboard hint */}
          <span className="hidden md:block text-xs text-muted-foreground/30 font-mono">⌘↵</span>

          {/* Run */}
          <button
            onClick={runCode}
            disabled={running}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg font-bold text-sm transition-all disabled:opacity-60"
            style={{ backgroundColor: "#22d3ee", color: "#080b14" }}
            onMouseEnter={e => !running && ((e.currentTarget as HTMLElement).style.backgroundColor = "#38e0f7")}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.backgroundColor = "#22d3ee")}
          >
            {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            <span className="hidden sm:block">{running ? "Running…" : "Run"}</span>
          </button>

          {/* History */}
          <button
            onClick={() => { fetchHistory(); setShowHistory(true); }}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/[0.05] transition-all"
            title="Execution history"
          >
            <Clock className="w-4 h-4" strokeWidth={1.5} />
          </button>

          <div className="w-px h-5 bg-white/[0.06]" />

          {/* User */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-cyan-500/10 border border-cyan-500/[0.18] flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-cyan-400 uppercase">{(user ?? "U")[0]}</span>
            </div>
            <span className="text-xs text-muted-foreground/60 hidden sm:block" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {user}
            </span>
            <button
              onClick={logout}
              className="p-1.5 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-white/[0.05] transition-all"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Panels ── */}
      <div className="flex-1 overflow-hidden">
        <PanelGroup direction="horizontal" className="h-full">
          <Panel defaultSize={58} minSize={25}>
            <div className="h-full border-r border-white/[0.04]">
              <CodeEditor
                code={code}
                onChange={setCode}
                disabled={running}
                language={language}
              />
            </div>
          </Panel>

          <PanelResizeHandle className="w-[3px] bg-transparent hover:bg-cyan-500/20 active:bg-cyan-500/30 transition-colors cursor-col-resize" />

          <Panel defaultSize={42} minSize={20}>
            <OutputPanel
              output={output}
              exitCode={exitCode}
              loading={running}
              error={outputError}
              execTime={execTime}
            />
          </Panel>
        </PanelGroup>
      </div>

      {/* ── Status bar ── */}
      <div
        className="flex items-center justify-between px-5 py-1 border-t border-white/[0.04] bg-[#080b14] shrink-0"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        <div className="flex items-center gap-5 text-[11px] text-muted-foreground/35">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: activeLang.dot }} />
            {activeLang.name}
          </span>
          <span>{code.split("\n").length} lines</span>
          <span className="hidden sm:block">{code.length} chars</span>
        </div>
        <div className="flex items-center gap-5 text-[11px] text-muted-foreground/35">
          {exitCode !== null && !running && (
            <span className={exitCode === 0 ? "text-green-400/50" : "text-red-400/50"}>
              {exitCode === 0 ? "✓ exit 0" : `✗ exit ${exitCode}`}
            </span>
          )}
          <span>UTF-8</span>
          <span>Spaces: 4</span>
        </div>
      </div>

      {/* ── History modal ── */}
      {showHistory && (
        <HistoryModal
          history={history}
          onSelect={item => {
            setLanguage(item.language);
            setCode(item.code);
            setOutput(item.output ?? "");
            setExitCode(item.exitCode ?? item.exit_code ?? null);
            setOutputError("");
          }}
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

function AppRouter() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div
        className="h-screen bg-background flex items-center justify-center"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        <div className="flex items-center gap-3 text-muted-foreground/50">
          <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
          <span className="text-sm">Loading…</span>
        </div>
      </div>
    );
  }

  return isAuthenticated ? <EditorPage /> : <LoginPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}
