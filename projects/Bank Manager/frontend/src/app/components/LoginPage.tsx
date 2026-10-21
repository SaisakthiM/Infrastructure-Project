import { useState } from "react";
import bankService from "../services/bankService";
import type { BankUser } from "./Dashboard";

interface LoginPageProps {
  onLogin: (user: BankUser) => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
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
          accountId: String(res.data.accountId),
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
    <main className="bk-center">
      <form className="glass accent" onSubmit={handleSubmit}>
        <div className="bd">
          <div className="row wrap" style={{ gap: 10, marginBottom: 4 }}>
            <span className="plate">
              <span className="code">D-01</span>
              <span className="name">Bank</span>
            </span>
            <span className="eyebrow">City treasury</span>
          </div>
          <h1 className="display" style={{ margin: "4px 0 6px", fontSize: 32 }}>{mode === "login" ? "Welcome back" : "Open an account"}</h1>
          <p className="muted" style={{ margin: "0 0 16px" }}>One account for every district — your balance and sign-in follow you everywhere.</p>
          <div className="tabs-row" style={{ padding: 0, marginBottom: 14 }}>
            <button type="button" className={mode === "login" ? "on" : ""} onClick={() => { setMode("login"); setError(""); }}>Log in</button>
            <button type="button" className={mode === "register" ? "on" : ""} onClick={() => { setMode("register"); setError(""); }}>Create account</button>
          </div>
          <label className="field">Username
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" placeholder="username" />
          </label>
          <label className="field">Password
            <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="password" />
          </label>
          <label className="muted" style={{ display: "flex", gap: 8, fontSize: 12, marginBottom: 12 }}>
            <input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} /> Show password
          </label>
          <button className="btn primary block" disabled={loading}>{loading ? "Please wait…" : mode === "login" ? "Enter the city" : "Open my account"}</button>
          <div className="bk-msg bad">{error}</div>
        </div>
      </form>
    </main>
  );
}
