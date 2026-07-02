import axios from "axios";

const BASE_URL = (import.meta as any).env?.VITE_API_URL || "https://saisakthi.qzz.io/";

const http = axios.create({ baseURL: BASE_URL });

http.interceptors.request.use((config) => {
  const token = localStorage.getItem("authToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const authAPI = {
  register: (username: string, password: string) =>
    http.post("/auth/register", { username, password }).then((r) => r.data),
  login: (username: string, password: string) =>
    http.post("/auth/login", { username, password }).then((r) => r.data),
  searchUsers: (query: string) =>
    http.get(`/auth/users/search?q=${encodeURIComponent(query)}`).then((r) => r.data),
  updateProfilePhoto: (userId: string | number, url: string) =>
    http.patch(`/auth/users/${userId}`, { profile_photo_url: url }).then((r) => r.data),
};

export const roomAPI = {
  getUserRooms: (userId: string | number) =>
    http.get(`/rooms?user_id=${userId}`).then((r) => r.data),
  createRoom: (name: string, userId: string | number) =>
    http.post("/rooms", { name, created_by: userId }).then((r) => r.data),
  joinRoom: (roomId: string | number, userId: string | number) =>
    http.post(`/rooms/${roomId}/join`, { user_id: userId }).then((r) => r.data),
  getRoomMembers: (roomId: string | number) =>
    http.get(`/rooms/${roomId}/members`).then((r) => r.data),
  discoverRooms: (userId: string | number, query: string) =>
    http.get(`/rooms/discover?user_id=${userId}&q=${encodeURIComponent(query)}`).then((r) => r.data),
};

export const messageAPI = {
  getMessages: (roomId: string | number, userId: string | number) =>
    http.get(`/rooms/${roomId}/messages?user_id=${userId}`).then((r) => r.data),
};

export const mediaAPI = {
  uploadImage: async (file: File, onProgress?: (p: number) => void) => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await http.post("/media/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded * 100) / e.total));
      },
    });
    return response.data;
  },
  resolveUrl: (url: string) => {
    if (!url) return "";
    if (url.startsWith("http")) return url;
    return `${BASE_URL}${url}`;
  },
};

export const createWebSocketConnection = (roomId: string | number, token: string) => {
  const wsBase = BASE_URL.replace(/^https?/, (p) => (p === "https" ? "wss" : "ws"));
  return new WebSocket(`${wsBase}/ws/${roomId}?token=${token}`);
};
