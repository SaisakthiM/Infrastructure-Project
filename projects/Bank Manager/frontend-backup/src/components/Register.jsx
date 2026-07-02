import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import axios from "axios"

export default function Register() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  async function handleRegister() {
    if (!username || !password) {
      setError("Please fill in all fields")
      return
    }
    setLoading(true)
    setError("")
    try {
      const res = await axios.post("/bank/api/auth/register", { username, password })
      if (res.data.success) {
        login(res.data.data)
        navigate("/")
      } else {
        setError(res.data.message)
      }
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="wrapper">
      <div className="container">
        <h1>Open Bank Account</h1>
        <h3>Register to get your account number</h3>
        <div className="form-group">
          <label>Username</label>
          <input type="text" placeholder="Choose a username" value={username}
            onChange={e => setUsername(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Password</label>
          <input type="password" placeholder="Choose a password" value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleRegister()} />
        </div>
        {error && <div className="error-message">{error}</div>}
        <div className="button-group">
          <button onClick={handleRegister} disabled={loading}>
            {loading ? "Creating Account..." : "Register"}
          </button>
          <button onClick={() => navigate("/login")}>Already have account?</button>
        </div>
      </div>
    </div>
  )
}
