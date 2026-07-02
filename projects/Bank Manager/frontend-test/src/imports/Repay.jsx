import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import bankService from "./bankService";

export default function Repay() {
    const navigate = useNavigate();
    const { user, login } = useAuth();
    const [amount, setAmount] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    const handleRepay = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage("");
        setError("");
        try {
            const response = await bankService.repayLoan(user.accountId, parseInt(amount));
            if (response) {                          // ✅ was response.data
                setMessage(`Successfully repaid ₹${amount}! Remaining loan: ₹${response.data.loanBalance}`);
                login({ 
                    ...user, 
                    balance: response.data.balance, 
                    creditScore: response.data.creditScore,  // ✅ updates credit score in context
                    loanBalance: response.data.loanBalance 
                });
                setAmount("");
            }
        } catch (err) {
            setError(err?.message || "Failed to process repayment");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="wrapper">
            <div className="container">
                <h1>Repay Loan</h1>
                <div className="account-details">
                    <p><strong>Account:</strong> {user?.accountNumber}</p>
                    <p><strong>Current Balance:</strong> ₹{user?.balance?.toLocaleString()}</p>
                    <p><strong>Credit Score:</strong> {user?.creditScore}</p>
                </div>
                {message && <div className="success-message">{message}</div>}
                {error && <div className="error-message">{error}</div>}
                <form onSubmit={handleRepay}>
                    <div className="form-group">
                        <label>Repayment Amount (₹):</label>
                        <input type="number" value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            required min="1" placeholder="Enter amount to repay" />
                    </div>
                    <div className="button-group">
                        <button type="submit" disabled={loading}>
                            {loading ? "Processing..." : "Repay"}
                        </button>
                        <button type="button" onClick={() => navigate("/")}>Back to Home</button>
                    </div>
                </form>
            </div>
        </div>
    );
}