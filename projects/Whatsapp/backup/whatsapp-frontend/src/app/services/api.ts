import axios from "axios";

// Set VITE_API_URL in your environment to point to your backend.
// Defaults to the current origin (saisakthi.qzz.io) with the /whisper/api
// prefix that the reverse proxy strips before forwarding to the Rust
// backend (main.rs mounts every route at root, e.g. "/users", "/room" —
// not "/whisper/api/users" — so the proxy must be doing that stripping).
const BASE_URL: string = (import.meta as any).env?.VITE_API_URL ?? "";
const API_PATH = "/whisper/api";

const http = axios.create({
  baseURL: BASE_URL + API_PATH,
  withCredentials: false,
});

http.interceptors.request.use((config) => {
  const token = localStorage.getItem("authToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const authAPI = {
  // POST /users -> CreateUserRequest { username, password }
  register: (username: string, password: string) =>
    http.post("/users", { username, password }).then((r) => r.data),

  // POST /login -> LoginRequest { username, password }
  login: (username: string, password: string) =>
    http.post("/login", { username, password }).then((r) => r.data),

  // GET /users/search -> SearchQuery { q }
  searchUsers: (query: string) =>
    http.get(`/users/search`, { params: { q: query } }).then((r) => r.data),

  getUser: (userId: string | number) =>
    http.get(`/users/${userId}`).then((r) => r.data),

  deleteUser: (userId: string | number) =>
    http.delete(`/users/${userId}`).then((r) => r.data),

  // PUT /users/{id} -> ModifyName { new_name } — renames the user.
  updateUsername: (userId: string | number, newName: string) =>
    http.put(`/users/${userId}`, { new_name: newName }).then((r) => r.data),

  // PUT /users/{id}/photo -> UpdateProfileRequest { profile_photo_url }
  // Separate route from the rename above — do not merge these.
  updateProfilePhoto: (userId: string | number, url: string) =>
    http.put(`/users/${userId}/photo`, { profile_photo_url: url }).then((r) => r.data),
};

export const roomAPI = {
  // GET /rooms -> GetRoomsParams { user_id }
  getUserRooms: (userId: string | number) =>
    http.get(`/rooms`, { params: { user_id: userId } }).then((r) => r.data),

  // POST /room -> ChatRoomRequest { name, creator_id }
  // NOTE: field is `creator_id`, not `created_by` — mismatch caused the 422.
  createRoom: (name: string, creatorId: string | number) =>
    http.post("/room", { name, creator_id: creatorId }).then((r) => r.data),

  // POST /room/join -> JoinRoomRequest { room_id, user_id }
  joinRoom: (roomId: string | number, userId: string | number) =>
    http.post(`/room/join`, { room_id: roomId, user_id: userId }).then((r) => r.data),

  // GET /room/{room_id}/members
  getRoomMembers: (roomId: string | number) =>
    http.get(`/room/${roomId}/members`).then((r) => r.data),

  // GET /rooms/discover -> DiscoverRoomsParams { user_id, q }
  discoverRooms: (userId: string | number, query: string) =>
    http
      .get(`/rooms/discover`, { params: { user_id: userId, q: query } })
      .then((r) => r.data),
};

export const messageAPI = {
  // GET /message -> MessageRequest { room_id, user_id }
  getMessages: (roomId: string | number, userId: string | number) =>
    http
      .get(`/message`, { params: { room_id: roomId, user_id: userId } })
      .then((r) => r.data),

  // POST /message -> CreateMessageRequest { room_id, sender_id, content, ... }
  // NOTE: field is `sender_id`, not `user_id`.
  sendMessage: (roomId: string | number, senderId: string | number, content: string) =>
    http
      .post("/message", { room_id: roomId, sender_id: senderId, content })
      .then((r) => r.data),
};

export const mediaAPI = {
  // media_routes() is merged with no path prefix in main.rs, so the real
  // route is POST /upload -> proxied publicly as /whisper/api/upload.
  uploadImage: async (file: File, onProgress?: (p: number) => void) => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await http.post("/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded * 100) / e.total));
      },
    });
    return response.data;
  },

  // Backend returns UploadResponse.url relative to ITS OWN root (e.g.
  // "/files/xxx.jpg"), since GET /files/{filename} is also unprefixed in
  // main.rs. The public site needs the /whisper/api prefix reattached, or
  // the browser will request saisakthi.qzz.io/files/... (404) instead of
  // saisakthi.qzz.io/whisper/api/files/... (proxied through to the backend).
  resolveUrl: (url: string): string => {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("//")) return url;
    return `${BASE_URL}${API_PATH}${url}`;
  },
};

export const createWebSocketConnection = (
  roomId: string | number,
  token: string
): WebSocket => {
  // nginx has a dedicated /whisper/api/ws/ location (more specific prefix
  // than /whisper/api/, so it wins the match) with Upgrade/Connection
  // headers wired in, rewriting to the backend's /ws/{room_id} route.
  const base = (BASE_URL || window.location.origin) + API_PATH;
  const wsBase = base.replace(/^http/, "ws");
  return new WebSocket(`${wsBase}/ws/${roomId}?token=${encodeURIComponent(token)}`);
};