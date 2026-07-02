import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import bankService from "./bankService";

export default function AddDeposit() {
    const navigate = useNavigate();
    const { user, login } = useAuth();
    const [amount, setAmount] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    const handleDeposit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage("");
        setError("");
        try {
            const response = await bankService.deposit(user.accountId, parseInt(amount));
            if (response.success) {
                setMessage(`Successfully deposited ₹${amount}! New balance: ₹${response.data.balance}`);
                login({ ...user, 
                    balance: response.data.balance,
                    creditScore: response.data.creditScore,
                    loanBalance: response.data.loanBalance
                });
                setAmount("");
            }
        } catch (err) {
            setError(err.message || "Failed to deposit money");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="wrapper">
            <div className="container">
                <h1>Add Deposit</h1>
                <div className="account-details">
                    <p><strong>Account:</strong> {user?.accountNumber}</p>
                    <p><strong>Current Balance:</strong> ₹{user.balance}</p>
                </div>
                {message && <div className="success-message">{message}</div>}
                {error && <div className="error-message">{error}</div>}
                <form onSubmit={handleDeposit}>
                    <div className="form-group">
                        <label>Amount to Deposit (₹):</label>
                        <input type="number" value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            required min="1" placeholder="Enter amount" />
                    </div>
                    <div className="button-group">
                        <button type="submit" disabled={loading}>
                            {loading ? "Processing..." : "Deposit"}
                        </button>
                        <button type="button" onClick={() => navigate("/")}>Back to Home</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
