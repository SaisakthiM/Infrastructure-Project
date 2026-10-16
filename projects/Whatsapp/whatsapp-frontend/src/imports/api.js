import axios from 'axios'

const API_BASE_URL = 'http://localhost:8000'

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
}, error => Promise.reject(error))

export const authAPI = {
  register: async (username, password) => {
    const response = await apiClient.post('/users', { username, password })
    return response.data
  },
  login: async (username, password) => {
    const response = await apiClient.post('/login', { username, password })
    return response.data
  },
  getUser: async (userId) => {
    const response = await apiClient.get(`/users/${userId}`)
    return response.data
  },
  updateUser: async (userId, newName) => {
    const response = await apiClient.put(`/users/${userId}`, { new_name: newName })
    return response.data
  },
  deleteUser: async (userId) => {
    const response = await apiClient.delete(`/users/${userId}`)
    return response.data
  },
  // NEW: Search users globally
  searchUsers: async (query) => {
    const response = await apiClient.get('/users/search', { params: { q: query } })
    return response.data || []
  },
  // NEW: Update profile photo
  updateProfilePhoto: async (userId, photoUrl) => {
    const response = await apiClient.put(`/users/${userId}/photo`, { profile_photo_url: photoUrl })
    return response.data
  }
}

export const roomAPI = {
  createRoom: async (name, creatorId) => {
    const response = await apiClient.post('/room', { name, creator_id: creatorId })
    return response.data
  },
  getUserRooms: async (userId) => {
    const response = await apiClient.get('/rooms', { params: { user_id: userId } })
    return response.data || []
  },
  joinRoom: async (roomId, userId) => {
    const response = await apiClient.post('/room/join', { room_id: roomId, user_id: userId })
    return response.data
  },
  getRoomMembers: async (roomId) => {
    const response = await apiClient.get(`/room/${roomId}/members`)
    return response.data || []
  },
  discoverRooms: async (userId, query = '') => {
    const response = await apiClient.get('/rooms/discover', { params: { user_id: userId, q: query } })
    return response.data || []
  }
}

export const messageAPI = {
  createMessage: async (roomId, senderId, content) => {
    const response = await apiClient.post('/message', {
      room_id: roomId,
      sender_id: senderId,
      content
    })
    return response.data
  },
  getMessages: async (roomId, userId) => {
    const response = await apiClient.get('/message', {
      params: { room_id: roomId, user_id: userId }
    })
    return response.data || []
  }
}

export const mediaAPI = {
  uploadImage: async (file, onProgress) => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await apiClient.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (evt) => {
        if (onProgress && evt.total) {
          onProgress(Math.round((evt.loaded * 100) / evt.total))
        }
      }
    })
    return response.data
  },
  resolveUrl: (path) => {
    if (!path) return path
    if (path.startsWith('http')) return path
    return `${API_BASE_URL}${path}`
  }
}

export const createWebSocketConnection = (roomId, token) => {
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const wsUrl = `${wsProtocol}//${window.location.hostname}:8000/ws/${roomId}?token=${token}`
  return new WebSocket(wsUrl)
}

export { API_BASE_URL }
export default apiClient