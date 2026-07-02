import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginUser } from "../api/authServices.js";
import useAuth from "./AuthContext.jsx";
import "../styles.css";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const navigate = useNavigate();
  const { loginSuccess } = useAuth();

  async function handleLogin() {
    setLoading(true);
    setMessage(null);
    try {
      const result = await loginUser(username, password);
      loginSuccess(result);
      setMessage("Login successful!");
      setTimeout(() => navigate("/"), 500);
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data || err.message || "Login failed.";
      setMessage(JSON.stringify(errMsg));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="wrapper">
      <div className="container">
        <h1>Login</h1>
        <label className="loginLabel">
          Username:{" "}
          <input className="inputLogin"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
          />
        </label>
        <br />
        <label className="loginLabel">
          Password:{" "}
          <input className="inputLogin"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
          />
        </label>
        <br />
        <div className="loginButton">
          <button onClick={handleLogin} disabled={loading} className="loginButtons">
          {loading ? "Logging in..." : "Login"}
          </button>
          <button onClick={() => navigate("/register")} className="loginButtons">Go to Register</button>
        </div>
        {message && <p>{message}</p>}
      </div>
    </div>
  );
}
