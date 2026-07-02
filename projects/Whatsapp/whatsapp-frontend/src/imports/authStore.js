import { create } from "zustand";
import { authAPI } from "../services/api";

export const useAuthStore = create((set) => ({
  user: null,
  token: null,
  isLoading: false,
  error: null,

  initAuth: () => {
    const token = localStorage.getItem("authToken");
    const userStr = localStorage.getItem("user");
    if (token && userStr) {
      set({ token, user: JSON.parse(userStr) });
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
      return response;
    } catch (error) {
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
      return response;
    } catch (error) {
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
