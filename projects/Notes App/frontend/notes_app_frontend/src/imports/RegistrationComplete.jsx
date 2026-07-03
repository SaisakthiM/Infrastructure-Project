import React from "react";
import { useNavigate } from "react-router-dom";
import "../styles.css";

export default function RegistrationComplete() {
  const navigate = useNavigate();

  return (
    <div className="wrapper">
      <div className="complete">
        <h1>Registration Completed 🎉</h1>
        <h2>Go to Login Page</h2>
        <button onClick={() => navigate("/login")}>Click Here</button>
      </div>
    </div>
  );
}
