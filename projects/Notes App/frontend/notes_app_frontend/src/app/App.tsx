import { useState, useEffect, useCallback, createContext, useContext } from "react";

type Page = "login" | "register" | "registered" | "home" | "addnote" | "editnote";

interface Note {
  id: number;
  title: string;
  content: string;
  created_at?: string;
  updated_at?: string;
}

interface AuthCtx {
  token: string | null;
  loginSuccess: (d: { access: string; refresh: string }) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthCtx | null>(null);
function useAuth() { return useContext(AuthContext)!; }

async function apiFetch(url: string, options: RequestInit = {}) {
  const res = await fetch(url, options);
  if (res.status === 204) return null;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error("API Error"), { data: json, status: res.status });
  return json;
}

function bearer(token: string): HeadersInit {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

// ─── Account screens ──────────────────────────────────────────────────────────

function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <main className="rr-center">
      <div className="glass accent">
        <div className="bd">
          <div className="eyebrow">The Reading Room</div>
          <h1 className="display" style={{ margin: "4px 0 4px", fontSize: 30 }}>{title}</h1>
          <p className="muted" style={{ margin: "0 0 16px" }}>{subtitle}</p>
          {children}
        </div>
      </div>
    </main>
  );
}

function LoginPage({ onNav }: { onNav: (p: Page) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { loginSuccess } = useAuth();

  async function handleLogin() {
    if (!username || !password) { setError("Please fill in all fields."); return; }
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch("/notes/api/token/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      loginSuccess(data);
      onNav("home");
    } catch (e: any) {
      const d = e.data || {};
      setError(d.detail || d.non_field_errors?.[0] || "Invalid credentials.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard title="Sign in" subtitle="Your personal archive of thoughts">
      <label className="field">Username
        <input value={username} autoFocus onChange={(e) => setUsername(e.target.value)} placeholder="your username" onKeyDown={(e) => e.key === "Enter" && handleLogin()} />
      </label>
      <label className="field">Password
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" onKeyDown={(e) => e.key === "Enter" && handleLogin()} />
      </label>
      <button className="btn primary block" onClick={handleLogin} disabled={loading}>{loading ? "Signing in…" : "Sign in"}</button>
      <div className="rr-msg bad">{error}</div>
      <button className="btn ghost block" onClick={() => onNav("register")}>New here? Create an account</button>
    </AuthCard>
  );
}

function RegisterPage({ onNav }: { onNav: (p: Page) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRegister() {
    if (!username || !password) { setError("Please fill in all fields."); return; }
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/notes/api/user/register/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      onNav("registered");
    } catch (e: any) {
      const d = e.data || {};
      setError(d.username?.[0] || d.password?.[0] || d.detail || "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard title="Register" subtitle="Begin your collection">
      <label className="field">Username
        <input value={username} autoFocus onChange={(e) => setUsername(e.target.value)} placeholder="choose a username" />
      </label>
      <label className="field">Password
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="choose a password" onKeyDown={(e) => e.key === "Enter" && handleRegister()} />
      </label>
      <button className="btn primary block" onClick={handleRegister} disabled={loading}>{loading ? "Creating…" : "Create account"}</button>
      <div className="rr-msg bad">{error}</div>
      <button className="btn ghost block" onClick={() => onNav("login")}>Already have an account? Sign in</button>
    </AuthCard>
  );
}

function RegistrationCompletePage({ onNav }: { onNav: (p: Page) => void }) {
  return (
    <AuthCard title="Welcome aboard" subtitle="Your account is ready.">
      <button className="btn primary block" onClick={() => onNav("login")}>Sign in</button>
    </AuthCard>
  );
}

// ─── Notes ────────────────────────────────────────────────────────────────────

function NoteCard({ note, onEdit, onDelete }: { note: Note; onEdit: () => void; onDelete: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const dateStr = note.updated_at || note.created_at;
  const formatted = dateStr ? new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
  const preview = note.content.length > 150 ? note.content.slice(0, 150) + "…" : note.content;
  return (
    <article className="glass rr-note">
      <div className="bd" style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        <h3>{note.title}</h3>
        <p>{preview}</p>
        <footer>
          <span>{formatted}</span>
          {confirm ? (
            <span className="btn-row">
              <button className="btn sm danger" onClick={onDelete}>Delete</button>
              <button className="btn sm ghost" onClick={() => setConfirm(false)}>Keep</button>
            </span>
          ) : (
            <span className="btn-row">
              <button className="btn sm" onClick={onEdit}>Edit</button>
              <button className="btn sm ghost" onClick={() => setConfirm(true)}>Delete</button>
            </span>
          )}
        </footer>
      </div>
    </article>
  );
}

function HomePage({ onNav, onEditNote }: { onNav: (p: Page) => void; onEditNote: (n: Note) => void }) {
  const { token, logout } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const fetchNotes = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch("/notes/api/notes/", { headers: { Authorization: `Bearer ${token}` } });
      setNotes(Array.isArray(data) ? data : (data?.results ?? []));
    } catch {
      setError("Could not load your notes. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  async function handleDelete(id: number) {
    if (!token) return;
    try {
      await apiFetch(`/notes/api/notes/${id}/`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } catch {
      setError("Could not delete the note.");
    }
  }

  const q = search.toLowerCase();
  const filtered = notes.filter((n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q));

  return (
    <main className="rr-page">
      <div className="rr-head">
        <h1 className="display">Your notes <small className="muted" style={{ fontSize: 14 }}>{notes.length}</small></h1>
        <input className="in" style={{ width: 220 }} placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <button className="btn primary" onClick={() => onNav("addnote")}>+ New note</button>
        <button className="btn ghost" onClick={logout}>Sign out of notes</button>
      </div>
      {error && <div className="glass"><div className="bd bad">{error} <button className="btn sm" onClick={fetchNotes}>Retry</button></div></div>}
      {loading ? <div className="glass"><div className="empty">Loading your notes…</div></div> :
        filtered.length === 0 ? <div className="glass"><div className="empty">{notes.length === 0 ? "No notes yet — write the first one." : "Nothing matches your search."}</div></div> : (
          <div className="rr-grid">
            {filtered.map((n) => <NoteCard key={n.id} note={n} onEdit={() => onEditNote(n)} onDelete={() => handleDelete(n.id)} />)}
          </div>
        )}
    </main>
  );
}

function NoteFormPage({ note, onNav }: { note?: Note; onNav: (p: Page) => void }) {
  const { token } = useAuth();
  const [title, setTitle] = useState(note?.title ?? "");
  const [content, setContent] = useState(note?.content ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const isEditing = !!note;

  async function handleSave() {
    if (!title.trim()) { setError("Please give your note a title."); return; }
    if (!content.trim()) { setError("Please write some content."); return; }
    setLoading(true);
    setError(null);
    try {
      if (isEditing) {
        await apiFetch(`/notes/api/notes/${note.id}/`, { method: "PUT", headers: bearer(token!), body: JSON.stringify({ title, content }) });
      } else {
        await apiFetch("/notes/api/notes/", { method: "POST", headers: bearer(token!), body: JSON.stringify({ title, content }) });
      }
      setSaved(true);
      setTimeout(() => onNav("home"), 600);
    } catch (e: any) {
      setError(e.data?.detail || "Could not save the note.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="rr-form">
      <div className="glass accent">
        <div className="hd">
          <span>{isEditing ? "Edit note" : "New note"}</span>
          <button className="btn sm ghost" onClick={() => onNav("home")}>← Back</button>
        </div>
        <div className="bd">
          <label className="field">Title
            <input value={title} autoFocus onChange={(e) => setTitle(e.target.value)} placeholder="A title for your thoughts" />
          </label>
          <label className="field">Content
            <textarea className="in" value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write here…" />
          </label>
          <div className="btn-row">
            <button className="btn primary" onClick={handleSave} disabled={loading || saved}>{saved ? "Saved ✓" : loading ? "Saving…" : "Save note"}</button>
            <button className="btn ghost" onClick={() => onNav("home")}>Cancel</button>
          </div>
          <div className="rr-msg bad">{error}</div>
        </div>
      </div>
    </main>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("access"));
  const [page, setPage] = useState<Page>(() => (localStorage.getItem("access") ? "home" : "login"));
  const [editingNote, setEditingNote] = useState<Note | undefined>();

  function loginSuccess(data: { access: string; refresh: string }) {
    localStorage.setItem("access", data.access);
    localStorage.setItem("refresh", data.refresh);
    setToken(data.access);
  }

  function logout() {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    setToken(null);
    setPage("login");
  }

  function goTo(p: Page) {
    if (p !== "editnote") setEditingNote(undefined);
    if ((p === "home" || p === "addnote" || p === "editnote") && !token) { setPage("login"); return; }
    setPage(p);
  }

  function handleEditNote(note: Note) {
    setEditingNote(note);
    setPage("editnote");
  }

  return (
    <AuthContext.Provider value={{ token, loginSuccess, logout }}>
      {page === "login" && <LoginPage onNav={goTo} />}
      {page === "register" && <RegisterPage onNav={goTo} />}
      {page === "registered" && <RegistrationCompletePage onNav={goTo} />}
      {page === "home" && token && <HomePage onNav={goTo} onEditNote={handleEditNote} />}
      {page === "addnote" && token && <NoteFormPage onNav={goTo} />}
      {page === "editnote" && token && editingNote && <NoteFormPage note={editingNote} onNav={goTo} />}
    </AuthContext.Provider>
  );
}
