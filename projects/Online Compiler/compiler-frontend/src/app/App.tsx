import { useState, useEffect, useContext, createContext, useCallback, useRef } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

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
// VITE_API_URL wins. Otherwise: behind the gateway (port 80/443) use the same-origin /compiler/api,
// and only for `vite dev` / direct-port use fall back to the compiler server on localhost:9090.

const API_URL: string = (() => {
  const env = (import.meta as any).env?.VITE_API_URL;
  if (env) return env;
  const { hostname, port, origin } = window.location;
  const local = hostname === "localhost" || hostname === "127.0.0.1";
  return local && port && port !== "80" && port !== "443" ? "http://localhost:9090" : `${origin}/compiler/api`;
})();

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

// ─── Sign in ──────────────────────────────────────────────────────────────────

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
    <main className="cf-login">
      <form className="glass accent" onSubmit={onSubmit}>
        <div className="bd">
          <div className="cf-brand"><i>{"</>"}</i> CodeFlow</div>
          <p className="muted" style={{ margin: "6px 0 16px" }}>Write, run and keep history for Python, JavaScript, C, C++, Java and Go.</p>
          <div className="tabs-row" style={{ padding: 0, marginBottom: 14 }}>
            <button type="button" className={tab === "login" ? "on" : ""} onClick={() => switchTab("login")}>Sign in</button>
            <button type="button" className={tab === "register" ? "on" : ""} onClick={() => switchTab("register")}>Create account</button>
          </div>
          <label className="field">Username
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" placeholder="username" />
          </label>
          <label className="field">Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={tab === "login" ? "current-password" : "new-password"} placeholder="password" />
          </label>
          <button className="btn primary block" disabled={submitting}>{submitting ? "Please wait…" : tab === "login" ? "Sign in" : "Create account"}</button>
          <div className="cf-note">
            {error && <span className="bad">{error}</span>}
            {success && <span className="ok">{success}</span>}
          </div>
        </div>
      </form>
    </main>
  );
}

// ─── Editor ───────────────────────────────────────────────────────────────────

function CodeEditor({ code, onChange, disabled, language }: {
  code: string;
  onChange: (v: string) => void;
  disabled: boolean;
  language: string;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const lang = LANGUAGES.find(l => l.id === language)!;
  const count = code.split("\n").length;

  const sync = () => {
    if (gutterRef.current && taRef.current) gutterRef.current.scrollTop = taRef.current.scrollTop;
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Tab") return;
    e.preventDefault();
    const ta = e.currentTarget;
    const s = ta.selectionStart, en = ta.selectionEnd;
    onChange(code.slice(0, s) + "    " + code.slice(en));
    requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = s + 4; });
  };

  return (
    <section className="glass cf-pane">
      <div className="hd"><span>main.{lang.ext}</span><small>{lang.name}</small></div>
      <div className="cf-editor">
        <div className="cf-gutter" ref={gutterRef}>{Array.from({ length: count }, (_, i) => i + 1).join("\n")}</div>
        <textarea
          ref={taRef}
          value={code}
          disabled={disabled}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          onChange={(e) => onChange(e.target.value)}
          onScroll={sync}
          onKeyDown={onKey}
          aria-label="Code editor"
        />
      </div>
    </section>
  );
}

function OutputPanel({ output, exitCode, loading, error, execTime }: {
  output: string;
  exitCode: number | null;
  loading: boolean;
  error: string;
  execTime: number | null;
}) {
  const ok = exitCode === 0;
  return (
    <section className="glass cf-pane">
      <div className="hd">
        <span>Output</span>
        {loading ? <span className="pill warn">running…</span> :
          exitCode !== null ? <span className={"pill " + (ok ? "ok" : "bad")}>{ok ? "exit 0" : `exit ${exitCode}`}{execTime !== null ? ` · ${execTime} ms` : ""}</span> : <small>Ctrl/⌘ + Enter to run</small>}
      </div>
      {loading ? <pre className="cf-out muted">Compiling and running…</pre> :
        !output && !error && exitCode === null ? <pre className="cf-out muted">Run your code to see the result here.</pre> : (
          <>
            {output && <pre className="cf-out">{output}</pre>}
            {error && <pre className="cf-out err">{error}</pre>}
          </>
        )}
    </section>
  );
}

function HistoryModal({ history, onSelect, onClose }: {
  history: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const q = search.toLowerCase();
  const filtered = history.filter(h => h.language.toLowerCase().includes(q) || h.code.toLowerCase().includes(q));

  return (
    <div className="cf-modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="glass accent">
        <div className="hd"><span>Execution history</span><button className="btn sm ghost" onClick={onClose}>Close</button></div>
        <div style={{ padding: "12px 16px" }}>
          <input ref={inputRef} className="in" style={{ width: "100%" }} placeholder="Search language or code…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="cf-hist">
          {filtered.length === 0 && <div className="empty">{history.length === 0 ? "Nothing run yet." : "No matches."}</div>}
          {filtered.map((h, i) => {
            const code = h.exitCode ?? h.exit_code ?? 0;
            return (
              <button key={i} onClick={() => { onSelect(h); onClose(); }}>
                <span className="eyebrow">{h.language}</span>{" "}
                <span className={"pill " + (code === 0 ? "ok" : "bad")}>exit {code}</span>{" "}
                <small className="muted">{h.timestamp ? new Date(h.timestamp).toLocaleString() : ""}</small>
                <code>{h.code.split("\n")[0]}</code>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

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
    if (!token || !code.trim() || running) return;
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
    <div className="cf-app" onKeyDown={onKeyDown}>
      <header className="glass cf-bar">
        <div className="cf-langs">
          {LANGUAGES.map(lang => (
            <button key={lang.id} className={"cf-lang" + (language === lang.id ? " on" : "")} onClick={() => switchLang(lang.id)}>
              <i style={{ background: lang.dot }} />{lang.name}
            </button>
          ))}
        </div>
        <button className="btn primary" onClick={runCode} disabled={running}>{running ? "Running…" : "▶ Run"}</button>
        <button className="btn" onClick={() => { fetchHistory(); setShowHistory(true); }} title="Execution history">History</button>
        <button className="btn ghost" onClick={logout} title={`Sign out ${user ?? ""}`}>{user} · Sign out</button>
      </header>

      <div className="cf-main">
        <PanelGroup direction="horizontal" className="h-full">
          <Panel defaultSize={58} minSize={25}>
            <CodeEditor code={code} onChange={setCode} disabled={running} language={language} />
          </Panel>
          <PanelResizeHandle className="cf-handle" />
          <Panel defaultSize={42} minSize={20}>
            <OutputPanel output={output} exitCode={exitCode} loading={running} error={outputError} execTime={execTime} />
          </Panel>
        </PanelGroup>
      </div>

      <footer className="glass cf-status">
        <span>{activeLang.name} · {code.split("\n").length} lines · {code.length} chars</span>
        <span>UTF-8 · Spaces: 4</span>
      </footer>

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
  if (loading) return <main className="cf-login"><div className="glass"><div className="bd muted">Loading…</div></div></main>;
  return isAuthenticated ? <EditorPage /> : <LoginPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}
