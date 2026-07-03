import { Navigate } from "react-router-dom";
import useAuth from "./AuthContext.jsx";

export default function ProtectedRoute({ children }) {
  const { user } = useAuth();

  if (!user || !user.token) {
    // 🔒 Not logged in → redirect to login page
    return <Navigate to="/login" replace />;
  }

  // ✅ Logged in → allow access
  return children;
}
