import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import axios from "axios"

export default function Login() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  async function handleLogin() {
    setLoading(true)
    setError("")
    try {
      const res = await axios.post("/bank/api/auth/login", { username, password })
      if (res.data.success) {
        login(res.data.data)
        navigate("/")
      } else {
        setError(res.data.message)
      }
    } catch (err) {
      setError(err.response?.data?.message || "Login failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="wrapper">
      <div className="container">
        <h1>Bank Manager</h1>
        <h3>Login to your account</h3>
        <div className="form-group">
          <label>Username</label>
          <input type="text" placeholder="Enter username" value={username}
            onChange={e => setUsername(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Password</label>
          <input type="password" placeholder="Enter password" value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleLogin()} />
        </div>
        {error && <div className="error-message">{error}</div>}
        <div className="button-group">
          <button onClick={handleLogin} disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
          <button onClick={() => navigate("/register")}>Create Account</button>
        </div>
      </div>
    </div>
  )
}
