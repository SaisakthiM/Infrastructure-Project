import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import bankService from "./bankService";

export default function GetAccount() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [account, setAccount] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        async function fetchAccount() {
            try {
                const response = await bankService.getAccountById(user.accountId);
                if (response.data) {
                    setAccount(response.data);
                }
            } catch (err) {
                setError(err.message || "Failed to fetch account");
            } finally {
                setLoading(false);
            }
        }
        fetchAccount();
    }, []);

    return (
        <div className="wrapper">
            <div className="container">
                <h1>Account Details</h1>
                {loading && <p>Loading...</p>}
                {error && <div className="error-message">{error}</div>}
                {account && (
                    <div className="account-details">
                        <h2>Account Information</h2>
                        <p><strong>Customer Name:</strong> {account.customerName}</p>
                        <p><strong>Account Number:</strong> {account.accountNumber}</p>
                        <p><strong>Balance:</strong> ₹{account.balance?.toLocaleString()}</p>
                        <p><strong>Loan Balance:</strong> ₹{account.loanBalance?.toLocaleString()}</p>
                        <p><strong>Credit Score:</strong> {account.creditScore}</p>
                        <p><strong>Created At:</strong> {new Date(account.createdAt).toLocaleDateString()}</p>
                        <p><strong>Updated At:</strong> {new Date(account.updatedAt).toLocaleDateString()}</p>
                    </div>
                )}
                <div className="button-group">
                    <button onClick={() => navigate("/")}>Back to Home</button>
                </div>
            </div>
        </div>
    );
}