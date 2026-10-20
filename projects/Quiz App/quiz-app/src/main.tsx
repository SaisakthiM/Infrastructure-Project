import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import { startCity } from "./city/startCity";
import "./styles/index.css";
import "./styles/quiz.css";

// Quiz Arena is a district of the Mini City: city HUD + login gate + its own 3D scene.
startCity({ service: "quiz", title: "Quiz Arena", accent: "#9b7bff", scene: "quiz" });

createRoot(document.getElementById("root")!).render(<App />);
