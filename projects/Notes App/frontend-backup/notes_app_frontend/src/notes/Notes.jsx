import "../styles.css";
import { useNavigate } from "react-router-dom";


export default function Notes(){
    const navigate = useNavigate();
    return (
        <div className="wrapper">
            <div className="container">
                <h1 className="main">Notes App</h1>
                <p>This is Notes App. Here, You can </p>
                <ol className="button_notes">
                    <li><button onClick={() => navigate('/addnote')}>Add a Note</button></li>
                    <li><button onClick={() => navigate('/deletenote')}>Delete a Note</button></li>
                    <li><button onClick={() => navigate('/modifynote')}>Modify a Note</button></li>
                </ol>
            </div>
        </div>
    )
}