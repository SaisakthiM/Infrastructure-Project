import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:9090'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Auth APIs
export const authAPI = {
  register: (username, password) => 
    api.post('/register', { username, password }),
  
  login: (username, password) => 
    api.post('/login', { username, password })
}

// Compiler APIs
export const compilerAPI = {
  executeCode: (language, code) => 
    api.post('/code', { language, code }),
  
  getHistory: () => 
    api.get('/history'),
  
  health: () => 
    api.get('/health')
}

export default api
