import { useState } from "react";
import { useNavigate, Link } from "react-router";
import { motion } from "motion/react";
import { useAuthStore } from "../store/authStore";
import { Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const { login, isLoading, error, clearError } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    try {
      await login(username, password);
      navigate("/");
    } catch {}
  };

  return (
    <div className="wa-auth-bg min-h-screen flex flex-col items-center justify-center p-4">
      {/* Decorative blobs */}
      <div className="wa-blob wa-blob-1" />
      <div className="wa-blob wa-blob-2" />

      <motion.div
        className="w-full max-w-[400px] relative z-10"
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Logo */}
        <motion.div
          className="text-center mb-10"
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.45, delay: 0.08 }}
        >
          <motion.div
            className="inline-flex items-center justify-center w-[72px] h-[72px] rounded-full mb-5"
            style={{ background: "linear-gradient(135deg,#00A884 0%,#025144 100%)", boxShadow: "0 0 48px rgba(0,168,132,0.5)" }}
            animate={{ scale: [1, 1.04, 1] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
          >
            <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.67-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.076 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/>
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.556 4.121 1.522 5.857L0 24l6.335-1.654A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.01-1.374l-.36-.213-3.723.972.996-3.617-.236-.373A9.775 9.775 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/>
            </svg>
          </motion.div>
          <h1 className="text-[2.2rem] font-extrabold tracking-tight mb-1.5" style={{ color: "#E9EDEF" }}>
            Whisper
          </h1>
          <p style={{ color: "#8696A0" }} className="text-sm">
            Welcome back — your chats are waiting
          </p>
        </motion.div>

        {/* Card */}
        <motion.div
          className="wa-card p-8 space-y-5"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.18 }}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="wa-label">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                className="wa-input"
                required
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="wa-label">Password</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="wa-input pr-11"
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 wa-icon-btn"
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                className="wa-error"
              >
                {error}
              </motion.div>
            )}

            <motion.button
              type="submit"
              disabled={isLoading}
              className="wa-btn-primary w-full mt-1"
              whileTap={{ scale: 0.98 }}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in…
                </span>
              ) : (
                "Sign in"
              )}
            </motion.button>
          </form>

          <div className="wa-divider" />

          <p className="text-center text-sm" style={{ color: "#8696A0" }}>
            {"Don't have an account? "}
            <Link to="/register" className="wa-link font-semibold">
              Create account
            </Link>
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
