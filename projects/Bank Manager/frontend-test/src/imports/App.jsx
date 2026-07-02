import { BrowserRouter, Routes, Route } from "react-router-dom"
import { AuthProvider } from "./context/AuthContext"
import ProtectedRoute from "./components/ProtectedRoute"
import Welcome from "./components/Welcome.jsx"
import AddDeposit from "./components/AddDeposit.jsx"
import Withdraw from "./components/Withdraw.jsx"
import GetAccount from "./components/GetAccount.jsx"
import Loan from "./components/Loan.jsx"
import Repay from "./components/Repay.jsx"
import Login from "./components/Login.jsx"
import Register from "./components/Register.jsx"
import "./style.css"

function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename="/bank/">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<ProtectedRoute><Welcome /></ProtectedRoute>} />
          <Route path="/add" element={<ProtectedRoute><AddDeposit /></ProtectedRoute>} />
          <Route path="/withdraw" element={<ProtectedRoute><Withdraw /></ProtectedRoute>} />
          <Route path="/account" element={<ProtectedRoute><GetAccount /></ProtectedRoute>} />
          <Route path="/loan" element={<ProtectedRoute><Loan /></ProtectedRoute>} />
          <Route path="/repay" element={<ProtectedRoute><Repay /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
