import React from "react";
import { Link, useNavigate } from "react-router-dom";
// Assuming your AuthContext provides a logout method and user details
import { useAuth } from "../components/AuthContext.jsx";

export default function HomePage() {
    const navigate = useNavigate();
    const { logout } = useAuth(); // Destructure logout if you have it in your AuthContext

    // Mock data for demonstration - in production, fetch this from your state/backend
    const mockNotes = [
        { id: 1, title: "Meeting Notes", content: "Discuss project timelines with the team." },
        { id: 2, title: "Grocery List", content: "Milk, Eggs, Bread, Coffee." },
    ];

    const handleLogout = () => {
        // Perform logout logic here (e.g., clearing tokens)
        if (logout) logout();
        navigate("/login");
    };

    return (
        <div className="wrapper">
            <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23eab308' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><path d='M2 6h4'/><path d='M2 10h4'/><path d='M2 14h4'/><path d='M2 18h4'/><rect width='16' height='20' x='4' y='2' rx='2'/><path d='M9.5 8h5'/><path d='M9.5 12H16'/><path d='M9.5 16H14'/></svg>"></link>
            <div className="container">
                {/* Header Section */}
                <h1 className="main">Notes Dashboard</h1>
                <p>Welcome back! Manage your thoughts and tasks below.</p>

                {/* Navigation Action Buttons */}
                <div className="button_notes">
                    <div className="buttons">
                        <button onClick={() => navigate("/addnote")}>➕ Add New Note</button>
                        <button onClick={handleLogout} style={{ backgroundColor: "#d9534f" }}>
                            Logout
                        </button>
                    </div>
                </div>

                {/* Notes List Section */}
                <div className="notes-list">
                    {mockNotes.length === 0 ? (
                        <p>No notes found. Click "Add New Note" to get started!</p>
                    ) : (
                        mockNotes.map((note) => (
                            <div key={note.id} className="note-item">
                                <div>
                                    <h3 style={{ margin: "0 0 5px 0", color: "rgb(30, 60, 90)" }}>
                                        {note.title}
                                    </h3>
                                    <p>{note.content}</p>
                                </div>

                                {/* Actions for each note */}
                                <div className="actions">
                                    <button
                                        onClick={() => navigate("/modifynote", { state: { noteId: note.id } })}
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => navigate("/deletenote", { state: { noteId: note.id } })}
                                        style={{ backgroundColor: "#6c757d" }}
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

            </div>
        </div>
    );
}