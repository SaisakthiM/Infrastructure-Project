import api from "./apiHandler";

// Register a new user
export async function registerUser(username, password) {
  const res = await api.post("/user/register/", { username, password });
  return res.data;
}

// Login user and store tokens
export async function loginUser(username, password) {
  const res = await api.post("/token/", { username, password });
  localStorage.setItem("access", res.data.access);
  localStorage.setItem("refresh", res.data.refresh);
  return res.data;
}
