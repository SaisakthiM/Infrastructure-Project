import { createContext,useContext, useState } from "react"

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("bankUser")
    return stored ? JSON.parse(stored) : null
  })

  function login(userData) {
    localStorage.setItem("bankUser", JSON.stringify(userData))
    setUser(userData)
  }

  function logout() {
    localStorage.removeItem("bankUser")
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
export function useAuth() {
    return useContext(AuthContext)
}

