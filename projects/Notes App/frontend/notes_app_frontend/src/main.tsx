import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import { startCity } from "./city/startCity";
import "./styles/index.css";
import "./styles/notes.css";

// The Reading Room is a district of the Mini City: city HUD + login gate + its own 3D scene.
startCity({ service: "notes", title: "The Reading Room", accent: "#e8b44f", scene: "library" });

createRoot(document.getElementById("root")!).render(<App />);
