import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import bankService from "./bankService";

export default function Loan() {
    const navigate = useNavigate();
    const { user, login } = useAuth();
    const [amount, setAmount] = useState("");
    const [months, setMonths] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    const handleLoan = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage("");
        setError("");
        try {
            const response = await bankService.takeLoan(user.accountId, parseInt(amount), parseInt(months));
            if (response) {                          // ← match deposit pattern
                setMessage(`Loan of ₹${amount} approved! New balance: ₹${response.data.balance}`);
                login({ 
                    ...user, 
                    balance: response.data.balance, 
                    creditScore: response.data.creditScore, 
                    loanBalance: response.data.loanBalance 
                });
                setAmount("");
                setMonths("");
            }
        } catch (err) {
            setError(err?.message || "Failed to process loan");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="wrapper">
            <div className="container">
                <h1>Take a Loan</h1>
                <div className="account-details">
                    <p><strong>Account:</strong> {user?.accountNumber}</p>
                    <p><strong>Current Balance:</strong> ₹{user?.balance?.toLocaleString()}</p>
                    <p><strong>Credit Score:</strong> {user?.creditScore}</p>
                </div>
                {message && <div className="success-message">{message}</div>}
                {error && <div className="error-message">{error}</div>}
                <form onSubmit={handleLoan}>
                    <div className="form-group">
                        <label>Loan Amount (₹):</label>
                        <input type="number" value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            required min="1000" placeholder="Enter loan amount" />
                    </div>
                    <div className="form-group">
                        <label>Repayment Period (months):</label>
                        <input type="number" value={months}
                            onChange={(e) => setMonths(e.target.value)}
                            required min="1" max="60" placeholder="e.g. 12" />
                    </div>
                    <div className="button-group">
                        <button type="submit" disabled={loading}>
                            {loading ? "Processing..." : "Apply for Loan"}
                        </button>
                        <button type="button" onClick={() => navigate("/")}>Back to Home</button>
                    </div>
                </form>
            </div>
        </div>
    );
}