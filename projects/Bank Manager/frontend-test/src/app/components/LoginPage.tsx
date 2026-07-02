import { useState } from "react";
import { Eye, EyeOff, Building2, Lock, User } from "lucide-react";
import bankService from "../services/bankService";
import type { BankUser } from "./Dashboard";

interface LoginPageProps {
  onLogin: (user: BankUser) => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [mode, setMode] = useState<"login" | "register">("register");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Username and password are required.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res =
        mode === "register"
          ? await bankService.register(username.trim(), password)
          : await bankService.login(username.trim(), password);

      if (res.success) {
        onLogin({
          username: res.data.username,
          accountNumber: res.data.accountNumber,
          accountId: res.data.accountId,
          balance: res.data.balance,
          creditScore: res.data.creditScore,
          loanBalance: res.data.loanBalance,
        });
      } else {
        setError(res.message || "Something went wrong.");
      }
    } catch (err: any) {
      setError(err?.message || (mode === "register" ? "Registration failed." : "Login failed."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative size-full flex items-center justify-center overflow-hidden">
      {/* Background */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url("https://images.unsplash.com/photo-1778429557352-ea4213f69e91?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwyfHxncmFuZCUyMGNsYXNzaWNhbCUyMGJhbmslMjBidWlsZGluZyUyMGFyY2hpdGVjdHVyZSUyMGZhY2FkZXxlbnwxfHx8fDE3ODI5Nzc3NTZ8MA&ixlib=rb-4.1.0&q=80&w=1080")`,
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900/75 via-slate-800/60 to-amber-900/50" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />

      {/* Card */}
      <div
        className="relative z-10 w-full max-w-md mx-4"
        style={{
          background: "rgba(255,255,255,0.08)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.18)",
          borderRadius: "1.5rem",
          boxShadow: "0 32px 64px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06)",
        }}
      >
        <div className="p-8">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div
              className="flex items-center justify-center w-14 h-14 rounded-2xl mb-3"
              style={{ background: "linear-gradient(135deg, #d4a017, #b8860b)" }}
            >
              <Building2 className="w-7 h-7 text-white" />
            </div>
            <h1
              className="text-white"
              style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.02em" }}
            >
              {mode === "register" ? "Open Bank Account" : "Welcome Back"}
            </h1>
            <p className="text-slate-300 mt-1" style={{ fontSize: "0.875rem" }}>
              {mode === "register"
                ? "Register to get your account number"
                : "Sign in to your account"}
            </p>
          </div>

          {/* Tabs */}
          <div
            className="flex rounded-xl p-1 mb-6"
            style={{ background: "rgba(255,255,255,0.08)" }}
          >
            {(["register", "login"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setMode(tab);
                  setError("");
                }}
                className="flex-1 py-2 rounded-lg transition-all duration-200"
                style={{
                  background: mode === tab ? "rgba(212,160,23,0.85)" : "transparent",
                  color: mode === tab ? "#fff" : "rgba(255,255,255,0.6)",
                  fontWeight: mode === tab ? 600 : 400,
                  fontSize: "0.875rem",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {tab === "register" ? "Register" : "Login"}
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                className="block mb-1.5"
                style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.8rem", fontWeight: 500 }}
              >
                Username
              </label>
              <div className="relative">
                <User
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                  style={{ color: "rgba(255,255,255,0.4)" }}
                />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  className="w-full pl-10 pr-4 py-3 rounded-xl outline-none"
                  style={{
                    background: "rgba(255,255,255,0.1)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    color: "#fff",
                    fontSize: "0.9rem",
                  }}
                  autoComplete="username"
                />
              </div>
            </div>

            <div>
              <label
                className="block mb-1.5"
                style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.8rem", fontWeight: 500 }}
              >
                Password
              </label>
              <div className="relative">
                <Lock
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                  style={{ color: "rgba(255,255,255,0.4)" }}
                />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full pl-10 pr-12 py-3 rounded-xl outline-none"
                  style={{
                    background: "rgba(255,255,255,0.1)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    color: "#fff",
                    fontSize: "0.9rem",
                  }}
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "rgba(255,255,255,0.4)",
                  }}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div
                className="rounded-lg px-3 py-2"
                style={{
                  background: "rgba(220,38,38,0.2)",
                  color: "#fca5a5",
                  border: "1px solid rgba(220,38,38,0.3)",
                  fontSize: "0.82rem",
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl transition-all duration-200 mt-2"
              style={{
                background: loading
                  ? "rgba(212,160,23,0.5)"
                  : "linear-gradient(135deg, #d4a017, #b8860b)",
                color: "#fff",
                fontWeight: 600,
                fontSize: "0.95rem",
                border: "none",
                cursor: loading ? "not-allowed" : "pointer",
                boxShadow: "0 4px 16px rgba(212,160,23,0.35)",
              }}
            >
              {loading
                ? mode === "register"
                  ? "Creating Account..."
                  : "Signing In..."
                : mode === "register"
                ? "Create Account"
                : "Sign In"}
            </button>
          </form>

          <p
            className="text-center mt-4"
            style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.78rem" }}
          >
            Secured with 256-bit encryption &bull; FDIC Insured
          </p>
        </div>
      </div>
    </div>
  );
}
