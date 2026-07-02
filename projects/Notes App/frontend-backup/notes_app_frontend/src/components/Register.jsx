import React, { useState } from "react";
import "../styles.css";
import { useNavigate } from "react-router-dom";
import { registerUser } from "../api/authServices.js";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const navigate = useNavigate();

  async function handleRegister() {
    setLoading(true);
    setMessage(null);
    try {
      const result = await registerUser(username, password);
      console.log("Register response:", result);
      setMessage("Registration successful!");
      // ✅ Navigate to success page
      setTimeout(() => navigate("/registered"), 1000);
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data || err.message || "Registration failed.";
      setMessage(JSON.stringify(errMsg));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="wrapper">
      <div className="container">
        <h1>Register</h1>
        <div>
          <label>
            Username : &nbsp;
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
            />
          </label>
        </div>
        <div>
          <label>
            Password : &nbsp;
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
            />
          </label>
        </div>

        <div className="buttons">
          <button
            type="button"
            onClick={handleRegister}
            disabled={loading}
          >
            {loading ? "Registering..." : "Register"}
          </button>

          {/* ✅ Simple navigation to login */}
          <button type="button" onClick={() => navigate("/login")}>
            Go To Login
          </button>
        </div>

        {message && <p>{message}</p>}
      </div>
    </div>
  );
}
