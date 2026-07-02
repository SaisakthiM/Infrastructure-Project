import axios from "axios";

const API_BASE = "/notes/api";

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

export default api;
