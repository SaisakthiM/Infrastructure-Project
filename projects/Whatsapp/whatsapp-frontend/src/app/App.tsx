import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { useAuthStore } from "./store/authStore";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ChatPage from "./pages/ChatPage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuthStore();
  if (!user || !token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuthStore();
  if (user && token) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  const initAuth = useAuthStore((s) => s.initAuth);

  useEffect(() => {
    initAuth();

    // Favicon: the district plate — ink glyph on a bone sheet, matching the registry roof labels.
    const link = document.createElement("link");
    link.rel = "icon";
    link.type = "image/svg+xml";
    link.href =
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect width='24' height='24' fill='%23f4f2ed'/%3E%3Cpath fill='none' stroke='%230f7a8c' stroke-width='1.6' stroke-linejoin='round' d='M3 5h18v11H9l-4 4v-4H3z'/%3E%3C/svg%3E";
    document.head.appendChild(link);
    document.title = "Whisper";

    return () => {
      document.head.removeChild(link);
    };
  }, [initAuth]);

  return (
    <BrowserRouter basename="/whisper/">
      <Routes>
        <Route path="/login" element={<AuthRoute><LoginPage /></AuthRoute>} />
        <Route path="/register" element={<AuthRoute><RegisterPage /></AuthRoute>} />
        <Route path="/" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
