import { create } from "zustand";
import { authAPI } from "../services/api";

interface User {
  id: string | number;
  username: string;
  profile_photo_url?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  initAuth: () => void;
  register: (username: string, password: string) => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
  setError: (error: string) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: false,
  error: null,

  initAuth: () => {
    const token = localStorage.getItem("authToken");
    const userStr = localStorage.getItem("user");
    if (token && userStr) {
      try {
        set({ token, user: JSON.parse(userStr) });
      } catch {}
    }
  },

  register: async (username, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authAPI.register(username, password);
      const user = { id: response.id, username };
      localStorage.setItem("authToken", response.token);
      localStorage.setItem("user", JSON.stringify(user));
      set({ user, token: response.token, isLoading: false });
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || "Registration failed";
      set({ error: errorMsg, isLoading: false });
      throw error;
    }
  },

  login: async (username, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authAPI.login(username, password);
      const user = { id: response.id, username };
      localStorage.setItem("authToken", response.token);
      localStorage.setItem("user", JSON.stringify(user));
      set({ user, token: response.token, isLoading: false });
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || "Login failed";
      set({ error: errorMsg, isLoading: false });
      throw error;
    }
  },

  logout: () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("user");
    set({ user: null, token: null, error: null });
  },

  setUser: (user) => set({ user }),
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),
}));
