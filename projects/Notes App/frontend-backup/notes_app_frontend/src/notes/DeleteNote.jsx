import { useEffect, useState } from "react";
import { getAllNotes, deleteNote } from "./NoteHandler";
import "../styles.css";

export default function DeleteNote() {
  const [notes, setNotes] = useState([]);
  const [selectedId, setSelectedId] = useState("");

  const fetchNotes = async () => {
    const data = await getAllNotes();
    setNotes(data);
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  const handleDelete = async () => {
    if (!selectedId) return;
    await deleteNote(selectedId);
    alert("Note deleted");
    fetchNotes();
    setSelectedId("");
  };

  return (
    <div className="wrapper">
      <div className="container">
        <h1>Delete Note</h1>

        <div className="loginLabel">
          <select
            className="inputLogin"
            onChange={(e) => setSelectedId(e.target.value)}
            value={selectedId}
          >
            <option value="">Select a note</option>
            {notes.map((note) => (
              <option key={note.id} value={note.id}>
                {note.title}
              </option>
            ))}
          </select>
        </div>

        <div className="loginButton">
          <button onClick={handleDelete} disabled={!selectedId}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
