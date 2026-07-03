import { useState, useEffect, useCallback, createContext, useContext } from "react";

// Set page title and SVG favicon
(function applyBranding() {
  document.title = "The Reading Room";
  const existing = document.querySelector("link[rel~='icon']");
  const link: HTMLLinkElement = (existing as HTMLLinkElement) ?? document.createElement("link");
  link.rel = "icon";
  link.type = "image/svg+xml";
  link.href =
    "data:image/svg+xml," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">` +
      `<rect width="32" height="32" rx="8" fill="#18120e"/>` +
      `<path d="M8 6h3v20H8zM13 6h2.5c3.5 0 6 2.5 6 6s-2.5 6-6 6H13V6z" fill="#c8922a"/>` +
      `</svg>`
    );
  if (!existing) document.head.appendChild(link);
})();
import {
  BookOpen, BookMarked, Feather, Plus, LogOut, Edit3,
  Trash2, ArrowLeft, X, Check, Search,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Auth context ─────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthCtx | null>(null);
function useAuth() { return useContext(AuthContext)!; }

// ─── API ──────────────────────────────────────────────────────────────────────

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

// ─── Design primitives ────────────────────────────────────────────────────────

function Input({
  label,
  className = "",
  ...props
}: { label: string; className?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label className="block text-[10px] tracking-[0.18em] uppercase text-muted-foreground"
        style={{ fontFamily: "var(--font-mono-custom)" }}>
        {label}
      </label>
      <input
        {...props}
        className="w-full bg-secondary border border-border rounded px-3.5 py-2.5 text-foreground text-sm
          placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/70
          focus:ring-1 focus:ring-primary/30 transition-all"
        style={{ fontFamily: "var(--font-serif)" }}
      />
    </div>
  );
}

function Btn({
  variant = "primary",
  children,
  className = "",
  ...props
}: {
  variant?: "primary" | "ghost" | "danger" | "link";
  children: React.ReactNode;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded px-4 py-2.5 text-sm transition-all " +
    "disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] select-none";
  const v = {
    primary: "bg-primary text-primary-foreground font-medium hover:bg-primary/85",
    ghost:
      "border border-border text-foreground hover:bg-secondary hover:border-border/70",
    danger:
      "bg-destructive/10 text-destructive border border-destructive/30 hover:bg-destructive/20",
    link: "text-primary hover:text-primary/75 underline underline-offset-2 px-0 py-0",
  };
  return (
    <button {...props} className={`${base} ${v[variant]} ${className}`}>
      {children}
    </button>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="bg-destructive/10 border border-destructive/30 rounded px-3.5 py-2.5 text-destructive text-sm">
      {msg}
    </div>
  );
}

// ─── Background ───────────────────────────────────────────────────────────────

function LibraryBg() {
  return (
    <div className="fixed inset-0 -z-10">
      <div className="absolute inset-0 bg-background" />
      {/* Lantern glow from top */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% -5%, rgba(200,146,42,0.13) 0%, transparent 70%)",
        }}
      />
      {/* Warm vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 120% 120% at 50% 50%, transparent 35%, rgba(10,6,3,0.65) 100%)",
        }}
      />
      {/* Faint ruled-paper lines */}
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, #c8922a 0px, #c8922a 1px, transparent 1px, transparent 32px)",
        }}
      />
    </div>
  );
}

// ─── Ornament ─────────────────────────────────────────────────────────────────

function Ornament() {
  return (
    <p
      className="text-center text-muted-foreground/30 text-[10px] mt-6 tracking-widest"
      style={{ fontFamily: "var(--font-mono-custom)" }}
    >
      ◆ &nbsp; EST. MMXXV &nbsp; ◆
    </p>
  );
}

function Divider() {
  return (
    <div className="h-px bg-gradient-to-r from-primary/30 via-primary/10 to-transparent my-6" />
  );
}

// ─── Auth shell (logo + card) ─────────────────────────────────────────────────

function AuthShell({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-9">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 border border-primary/25 mb-4">
            {icon}
          </div>
          <h1
            className="text-3xl text-foreground"
            style={{ fontFamily: "var(--font-display)" }}
          >
            The Reading Room
          </h1>
          <p
            className="text-muted-foreground text-sm mt-1 italic"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {subtitle}
          </p>
        </div>

        <div className="bg-card border border-border rounded-lg p-8 shadow-2xl space-y-5">
          <div className="pb-4 border-b border-border">
            <h2
              className="text-xl text-foreground"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {title}
            </h2>
          </div>
          {children}
        </div>

        <Ornament />
      </div>
    </div>
  );
}

// ─── Login ────────────────────────────────────────────────────────────────────

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
    <AuthShell
      icon={<BookOpen className="w-8 h-8 text-primary" />}
      title="Sign In"
      subtitle="Your personal archive of thoughts"
    >
      <Input
        label="Username"
        type="text"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="your username"
        autoFocus
        onKeyDown={(e) => e.key === "Enter" && handleLogin()}
      />
      <Input
        label="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="••••••••"
        onKeyDown={(e) => e.key === "Enter" && handleLogin()}
      />

      {error && <ErrorBox msg={error} />}

      <Btn variant="primary" onClick={handleLogin} disabled={loading} className="w-full">
        {loading ? "Opening the door…" : "Enter the Library"}
      </Btn>

      <p
        className="text-center text-sm pt-1"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        <span className="text-muted-foreground">New reader? </span>
        <Btn variant="link" onClick={() => onNav("register")}>
          Register here
        </Btn>
      </p>
    </AuthShell>
  );
}

// ─── Register ─────────────────────────────────────────────────────────────────

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
    <AuthShell
      icon={<Feather className="w-8 h-8 text-primary" />}
      title="Register"
      subtitle="Begin your collection"
    >
      <Input
        label="Username"
        type="text"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="choose a username"
        autoFocus
      />
      <Input
        label="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="••••••••"
        onKeyDown={(e) => e.key === "Enter" && handleRegister()}
      />

      {error && <ErrorBox msg={error} />}

      <Btn variant="primary" onClick={handleRegister} disabled={loading} className="w-full">
        {loading ? "Registering…" : "Open an Account"}
      </Btn>

      <p
        className="text-center text-sm pt-1"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        <span className="text-muted-foreground">Already a member? </span>
        <Btn variant="link" onClick={() => onNav("login")}>
          Sign in
        </Btn>
      </p>
    </AuthShell>
  );
}

// ─── Registration complete ────────────────────────────────────────────────────

function RegistrationCompletePage({ onNav }: { onNav: (p: Page) => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 border border-primary/30 mb-7">
          <Check className="w-10 h-10 text-primary" />
        </div>
        <h1
          className="text-3xl text-foreground mb-3"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Welcome to the Library
        </h1>
        <p
          className="text-muted-foreground italic text-sm leading-relaxed mb-8"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          "A reader lives a thousand lives before he dies. The man who never reads lives only one."
        </p>
        <Btn variant="primary" onClick={() => onNav("login")} className="mx-auto">
          <BookOpen className="w-4 h-4" />
          Enter the Reading Room
        </Btn>
        <Ornament />
      </div>
    </div>
  );
}

// ─── Note card ────────────────────────────────────────────────────────────────

function NoteCard({
  note,
  onEdit,
  onDelete,
}: {
  note: Note;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const dateStr = note.updated_at || note.created_at;
  const formatted = dateStr
    ? new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;
  const preview =
    note.content.length > 150 ? note.content.slice(0, 150) + "…" : note.content;

  return (
    <div className="group relative bg-card border border-border rounded-lg p-5 flex flex-col gap-3
      hover:border-primary/35 transition-all duration-200 hover:shadow-lg hover:shadow-black/30
      cursor-default">
      {/* Left accent bar */}
      <div className="absolute left-0 top-3 bottom-3 w-[2px] rounded-r bg-primary/0 group-hover:bg-primary/50 transition-all duration-300" />

      <div className="flex items-start justify-between gap-2">
        <h3
          className="text-foreground leading-snug text-base flex-1"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {note.title}
        </h3>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5">
          <button
            onClick={onEdit}
            title="Edit note"
            className="p-1.5 rounded text-muted-foreground hover:text-primary hover:bg-secondary transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          {confirm ? (
            <div className="flex items-center gap-1 ml-1">
              <button
                onClick={onDelete}
                className="text-[11px] px-2 py-1 rounded bg-destructive/20 text-destructive hover:bg-destructive/30 transition-colors"
              >
                Delete
              </button>
              <button
                onClick={() => setConfirm(false)}
                className="p-1.5 rounded text-muted-foreground hover:bg-secondary transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirm(true)}
              title="Delete note"
              className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-secondary transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <p
        className="text-muted-foreground text-sm leading-relaxed flex-1"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        {preview}
      </p>

      {formatted && (
        <p
          className="text-muted-foreground/45 text-[10px] tracking-widest uppercase"
          style={{ fontFamily: "var(--font-mono-custom)" }}
        >
          {formatted}
        </p>
      )}
    </div>
  );
}

// ─── Home / dashboard ─────────────────────────────────────────────────────────

function HomePage({
  onNav,
  onEditNote,
}: {
  onNav: (p: Page) => void;
  onEditNote: (n: Note) => void;
}) {
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
      const data = await apiFetch("/notes/api/notes/", {
        headers: { Authorization: `Bearer ${token}` },
      });
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
      await apiFetch(`/notes/api/notes/${id}/`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } catch {
      setError("Could not delete the note.");
    }
  }

  const filtered = notes.filter(
    (n) =>
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      n.content.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen">
      {/* Sticky header */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <BookMarked className="w-5 h-5 text-primary shrink-0" />
            <span
              className="text-foreground text-lg leading-none"
              style={{ fontFamily: "var(--font-display)" }}
            >
              The Reading Room
            </span>
            <span
              className="hidden sm:inline text-muted-foreground/35 text-[10px] tracking-widest ml-1 mt-0.5"
              style={{ fontFamily: "var(--font-mono-custom)" }}
            >
              / NOTES
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Btn
              variant="primary"
              onClick={() => onNav("addnote")}
              className="py-1.5 px-3 text-xs gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Note</span>
            </Btn>
            <Btn
              variant="ghost"
              onClick={() => { logout(); onNav("login"); }}
              className="py-1.5 px-3 text-xs gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Leave</span>
            </Btn>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Page heading */}
        <div className="mb-7">
          <h1
            className="text-4xl sm:text-5xl text-foreground"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Your Collection
          </h1>
          <p
            className="text-muted-foreground italic mt-1.5 text-sm"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {loading
              ? "Gathering your entries…"
              : `${notes.length} ${notes.length === 1 ? "entry" : "entries"} in your archive`}
          </p>
          <Divider />
        </div>

        {/* Search */}
        {notes.length > 0 && (
          <div className="relative mb-6 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search your notes…"
              className="w-full bg-secondary border border-border rounded pl-9 pr-3.5 py-2 text-sm text-foreground
                placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/25 transition-all"
              style={{ fontFamily: "var(--font-serif)" }}
            />
          </div>
        )}

        {error && <ErrorBox msg={error} />}

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="bg-card border border-border rounded-lg h-36 animate-pulse opacity-50"
              />
            ))}
          </div>
        ) : notes.length === 0 ? (
          <div className="text-center py-24">
            <BookOpen className="w-14 h-14 text-muted-foreground/20 mx-auto mb-5" />
            <p
              className="text-2xl text-muted-foreground mb-2"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Your archive is empty
            </p>
            <p
              className="text-muted-foreground/60 text-sm italic mb-7"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              Every great collection begins with a single entry
            </p>
            <Btn variant="primary" onClick={() => onNav("addnote")} className="mx-auto">
              <Feather className="w-4 h-4" />
              Write your first note
            </Btn>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p
              className="text-muted-foreground text-lg"
              style={{ fontFamily: "var(--font-display)" }}
            >
              No notes match "{search}"
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onEdit={() => onEditNote(note)}
                onDelete={() => handleDelete(note.id)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Note form (add / edit) ───────────────────────────────────────────────────

function NoteFormPage({
  note,
  onNav,
}: {
  note?: Note;
  onNav: (p: Page) => void;
}) {
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
        await apiFetch(`/notes/api/notes/${note.id}/`, {
          method: "PUT",
          headers: bearer(token!),
          body: JSON.stringify({ title, content }),
        });
      } else {
        await apiFetch("/notes/api/notes/", {
          method: "POST",
          headers: bearer(token!),
          body: JSON.stringify({ title, content }),
        });
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
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <button
            onClick={() => onNav("home")}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span style={{ fontFamily: "var(--font-serif)" }}>Back to collection</span>
          </button>
          <Btn
            variant="primary"
            onClick={handleSave}
            disabled={loading || saved}
            className="py-1.5 px-4 text-sm gap-1.5"
          >
            {saved ? (
              <>
                <Check className="w-3.5 h-3.5" />
                Saved
              </>
            ) : loading ? (
              "Saving…"
            ) : isEditing ? (
              "Update Note"
            ) : (
              "Save Note"
            )}
          </Btn>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-6">
          <h1
            className="text-3xl text-foreground"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {isEditing ? "Edit Entry" : "New Entry"}
          </h1>
          <Divider />
        </div>

        {/* Paper-like writing area */}
        <div className="bg-card border border-border rounded-lg overflow-hidden shadow-2xl">
          {/* Notebook header strip */}
          <div className="border-b border-border/60 px-6 pt-5 pb-4 space-y-1">
            <div className="h-px bg-border/40" />
            <div className="h-px bg-border/25" />
          </div>

          <div className="px-6 py-5 space-y-6">
            {/* Title field */}
            <div>
              <label
                className="block text-[10px] tracking-[0.18em] uppercase text-muted-foreground mb-2"
                style={{ fontFamily: "var(--font-mono-custom)" }}
              >
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Give your note a title…"
                className="w-full bg-transparent border-b border-border/50 pb-2 text-foreground text-2xl
                  placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/60 transition-colors"
                style={{ fontFamily: "var(--font-display)" }}
              />
            </div>

            {/* Content field */}
            <div>
              <label
                className="block text-[10px] tracking-[0.18em] uppercase text-muted-foreground mb-2"
                style={{ fontFamily: "var(--font-mono-custom)" }}
              >
                Content
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your thoughts here…"
                rows={16}
                className="w-full bg-transparent resize-none text-foreground text-base leading-[1.85]
                  placeholder:text-muted-foreground/30 focus:outline-none"
                style={{ fontFamily: "var(--font-serif)" }}
              />
            </div>

            {error && <ErrorBox msg={error} />}
          </div>

          {/* Char count footer */}
          <div className="border-t border-border/40 px-6 py-2.5 flex justify-between items-center">
            <span
              className="text-muted-foreground/40 text-[10px] tracking-wider"
              style={{ fontFamily: "var(--font-mono-custom)" }}
            >
              {content.length} characters
            </span>
            {isEditing && note?.updated_at && (
              <span
                className="text-muted-foreground/40 text-[10px] tracking-wider"
                style={{ fontFamily: "var(--font-mono-custom)" }}
              >
                Last edited{" "}
                {new Date(note.updated_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem("access")
  );
  const [page, setPage] = useState<Page>(() =>
    localStorage.getItem("access") ? "home" : "login"
  );
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
  }

  function goTo(p: Page) {
    if (p !== "editnote") setEditingNote(undefined);
    // Guard protected routes
    if ((p === "home" || p === "addnote" || p === "editnote") && !token) {
      setPage("login");
      return;
    }
    setPage(p);
  }

  function handleEditNote(note: Note) {
    setEditingNote(note);
    setPage("editnote");
  }

  return (
    <AuthContext.Provider value={{ token, loginSuccess, logout }}>
      <LibraryBg />
      <div className="relative min-h-screen">
        {page === "login" && <LoginPage onNav={goTo} />}
        {page === "register" && <RegisterPage onNav={goTo} />}
        {page === "registered" && <RegistrationCompletePage onNav={goTo} />}
        {page === "home" && token && (
          <HomePage onNav={goTo} onEditNote={handleEditNote} />
        )}
        {page === "addnote" && token && (
          <NoteFormPage onNav={goTo} />
        )}
        {page === "editnote" && token && editingNote && (
          <NoteFormPage note={editingNote} onNav={goTo} />
        )}
      </div>
    </AuthContext.Provider>
  );
}
