import { useState } from "react";
import "../styles.css";
import { addNote, refreshAccessToken } from "./NoteHandler";

export default function AddNote() {
    const [task, setTask] = useState({
        name: "",
        content: "",
        deadline: "",
        importance: "low",
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setTask((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async () => {
        console.log("New Task:", task);
        await refreshAccessToken();
        const result = await addNote(task.name, task.content, task.deadline, task.importance);
        console.log("Note created:", result);    };

    return (
        <div className="wrapper">
        <div className="container">
            <h1>Add a Note</h1>
            <ol>
            <li>
                <label>
                Name of the Task :
                <input
                    type="text"
                    name="name"
                    value={task.name}
                    onChange={handleChange}
                />
                </label>
            </li>

            <li>
                <label>
                Contents of the Task :
                <input
                    type="text"
                    name="content"
                    value={task.content}
                    onChange={handleChange}
                />
                </label>
            </li>

            <li>
                <label>
                Deadline of the Task :
                <input
                    type="date"
                    name="deadline"
                    value={task.deadline}
                    onChange={handleChange}
                />
                </label>
            </li>

            <li>
                <label>
                Importance of the Task :
                <select
                    name="importance"
                    value={task.importance}
                    onChange={handleChange}
                >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                </select>
                </label>
            </li>
            </ol>

            <button onClick={handleSubmit}>Add Task</button>
        </div>
        </div>
    );
}
