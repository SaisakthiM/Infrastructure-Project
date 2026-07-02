import { useEffect, useState } from "react";
import { getAllNotes, updateNote } from "./NoteHandler";
import "../styles.css";

export default function ModifyNote() {
  const [notes, setNotes] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState({
    title: "",
    content: "",
    deadline: "",
    importance: "",
  });

  const fetchNotes = async () => {
    const data = await getAllNotes();
    setNotes(data);
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  const handleSelect = (id) => {
    setSelectedId(id);
    const note = notes.find((n) => n.id === parseInt(id));

    if (note) {
      setForm({
        title: note.title,
        content: note.content,
        deadline: note.deadline,
        importance: note.importance,
      });
    }
  };

  const handleUpdate = async () => {
    await updateNote(selectedId, form);
    alert("Note updated");
  };

  return (
    <div className="wrapper">
      <div className="container">
        <h1>Modify Note</h1>

        {/* Dropdown to choose note */}
        <div className="loginLabel">
          <select
            className="inputLogin"
            onChange={(e) => handleSelect(e.target.value)}
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

        {/* If a note is selected, show form */}
        {selectedId && (
          <>
            <div className="loginLabel">
              <input
                className="inputLogin"
                type="text"
                value={form.title}
                onChange={(e) =>
                  setForm({ ...form, title: e.target.value })
                }
                placeholder="Title"
              />
            </div>

            <div className="loginLabel">
              <textarea
                className="inputLogin"
                style={{ height: "100px" }}
                value={form.content}
                onChange={(e) =>
                  setForm({ ...form, content: e.target.value })
                }
                placeholder="Content"
              ></textarea>
            </div>

            <div className="loginLabel">
              <input
                className="inputLogin"
                type="date"
                value={form.deadline}
                onChange={(e) =>
                  setForm({ ...form, deadline: e.target.value })
                }
              />
            </div>

            <div className="loginLabel">
              <input
                className="inputLogin"
                type="text"
                value={form.importance}
                onChange={(e) =>
                  setForm({ ...form, importance: e.target.value })
                }
                placeholder="Importance"
              />
            </div>

            <div className="loginButton">
              <button onClick={handleUpdate}>Update</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
