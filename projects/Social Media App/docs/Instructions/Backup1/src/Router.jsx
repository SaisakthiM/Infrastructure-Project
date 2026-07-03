import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

// Import example pages from Vision UI
import Dashboard from "./examples/Dashboard";
import Profile from "./examples/Profile"; // if you have this

export default function AppRouter() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/profile" element={<Profile />} />
        {/* Add more routes as needed */}
      </Routes>
    </Router>
  );
}
