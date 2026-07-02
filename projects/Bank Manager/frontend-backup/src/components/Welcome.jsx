import { useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"

export default function Welcome() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  function handleLogout() {
    logout()
    navigate("/login")
  }

  return (
    <div className="wrapper">
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23059669' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><path d='M10 18v-7'/><path d='M11.119 2.205a2 2 0 0 1 1.762 0l7.84 3.846A.5.5 0 0 1 20.5 7h-17a.5.5 0 0 1-.22-.949z'/><path d='M14 18v-7'/><path d='M18 18v-7'/><path d='M3 22h18'/><path d='M6 18v-7'/></svg>"></link>      <div className="container">
        <h1>Welcome, {user?.username}!</h1>
        <div className="account-details">
          <h2>Your Account Details</h2>
          <p><strong>Account Number:</strong> {user?.accountNumber}</p>
          <p><strong>Balance:</strong> ₹{user?.balance?.toLocaleString() ?? 0}</p>
          <p><strong>Credit Score:</strong> {user?.creditScore}</p>
          <p><strong>Loan Balance:</strong> ₹{user?.loanBalance?.toLocaleString() ?? 0}</p>
        </div>
        <h3>What would you like to do?</h3>
        <ol>
          <li><button onClick={() => navigate('/add')}>Add a Deposit</button></li>
          <li><button onClick={() => navigate('/withdraw')}>Withdraw from Deposit</button></li>
          <li><button onClick={() => navigate('/account')}>Get Account Details</button></li>
          <li><button onClick={() => navigate('/loan')}>Take a Loan</button></li>
          <li><button onClick={() => navigate('/repay')}>Repay Credit/Loan</button></li>
        </ol>
        <div className="button-group">
          <button onClick={handleLogout}>Logout</button>
        </div>
      </div>
    </div>
  )
}