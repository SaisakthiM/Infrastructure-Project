import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { AuthProvider, useAuth } from './context/AuthContext';
import Layout     from './components/layout/Layout';
import { Spinner } from './components/common/Loaders';

import LoginPage        from './pages/LoginPage';
import RegisterPage     from './pages/RegisterPage';
import HomePage         from './pages/HomePage';
import ExplorePage      from './pages/ExplorePage';
import SearchPage       from './pages/SearchPage';
import ProfilePage      from './pages/ProfilePage';
import MessagesPage     from './pages/MessagesPage';
import NotificationsPage from './pages/NotificationsPage';
import ReelsPage        from './pages/ReelsPage';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
  return user ? children : <Navigate to="/login" replace />;
}

function GuestRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
  return !user ? children : <Navigate to="/" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Guest routes */}
      <Route path="/login"    element={<GuestRoute><LoginPage /></GuestRoute>} />
      <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />

      {/* Protected routes inside Layout */}
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>} >
        <Route path="/"                       element={<HomePage />} />
        <Route path="/explore"                element={<ExplorePage />} />
        <Route path="/search"                 element={<SearchPage />} />
        <Route path="/reels"                  element={<ReelsPage />} />
        <Route path="/messages"               element={<MessagesPage />} />
        <Route path="/notifications"          element={<NotificationsPage />} />
        <Route path="/profile/:username"      element={<ProfilePage />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter basename="/social">
      <AuthProvider>
        <AppRoutes />
        <ToastContainer
          position="bottom-right"
          theme="dark"
          toastStyle={{
            background: '#1a1a1a',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#fff',
            borderRadius: '12px',
            fontSize: '14px',
          }}
          autoClose={3000}
          hideProgressBar
        />
      </AuthProvider>
    </BrowserRouter>
  );
}

