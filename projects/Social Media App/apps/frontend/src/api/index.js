import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach access token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = localStorage.getItem('refresh');
      if (refresh) {
        try {
          const { data } = await axios.post(`${BASE_URL}/auth/token/refresh/`, { refresh });
          localStorage.setItem('access', data.access);
          original.headers.Authorization = `Bearer ${data.access}`;
          return api(original);
        } catch {
          localStorage.clear();
          window.location.href = '/social/login';
        }
      }
    }
    return Promise.reject(err);
  }
);

export default api;

// ── Auth ────────────────────────────────────────────────────
export const authAPI = {
  register: (d) => api.post('/auth/register/', d),
  login:    (d) => api.post('/auth/login/', d),
  logout:   (d) => api.post('/auth/logout/', d),
  me:       ()  => api.get('/auth/me/'),
};

// ── Users ───────────────────────────────────────────────────
export const usersAPI = {
  profile:   (username)  => api.get(`/users/${username}/`),
  update:    (username, d) => api.patch(`/users/${username}/update/`, d, { headers: { 'Content-Type': 'multipart/form-data' } }),
  follow:    (username)  => api.post(`/users/${username}/follow/`),
  followers: (username)  => api.get(`/users/${username}/followers/`),
  following: (username)  => api.get(`/users/${username}/following/`),
  search:    (q)         => api.get('/users/search/', { params: { q } }),
  suggested: ()          => api.get('/users/suggested/'),
};

// ── Posts ───────────────────────────────────────────────────
export const postsAPI = {
  feed:        (page = 1)  => api.get('/posts/', { params: { page } }),
  explore:     (page = 1)  => api.get('/posts/explore/', { params: { page } }),
  create:      (d)         => api.post('/posts/create/', d, { headers: { 'Content-Type': 'multipart/form-data' } }),
  get:         (id)        => api.get(`/posts/${id}/`),
  delete:      (id)        => api.delete(`/posts/${id}/`),
  like:        (id)        => api.post(`/posts/${id}/like/`),
  save:        (id)        => api.post(`/posts/${id}/save/`),
  comments:    (id)        => api.get(`/posts/${id}/comments/`),
  addComment:  (id, d)     => api.post(`/posts/${id}/comments/`, d),
  delComment:  (id)        => api.delete(`/posts/comments/${id}/`),
  userPosts:   (username)  => api.get(`/posts/user/${username}/`),
  saved:       ()          => api.get('/posts/saved/'),
  search:      (q)         => api.get('/posts/search/', { params: { q } }),
};

// ── Stories ─────────────────────────────────────────────────
export const storiesAPI = {
  feed:   ()   => api.get('/stories/'),
  create: (d)  => api.post('/stories/create/', d, { headers: { 'Content-Type': 'multipart/form-data' } }),
  delete: (id) => api.delete(`/stories/${id}/delete/`),
  view:   (id) => api.post(`/stories/${id}/view/`),
};

// ── Notifications ────────────────────────────────────────────
export const notifsAPI = {
  list:     (page = 1) => api.get('/notifications/', { params: { page } }),
  markRead: ()         => api.post('/notifications/read/'),
  unread:   ()         => api.get('/notifications/unread/'),
};

// ── Messages ─────────────────────────────────────────────────
export const messagesAPI = {
  conversations: ()       => api.get('/messages/'),
  start:         (username) => api.post('/messages/start/', { username }),
  messages:      (id, page = 1) => api.get(`/messages/${id}/messages/`, { params: { page } }),
  send:          (id, d)  => api.post(`/messages/${id}/send/`, d, { headers: { 'Content-Type': 'multipart/form-data' } }),
};

