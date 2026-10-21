import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import { startCity } from "./city/startCity";
import "./styles/index.css";
import "./styles/compiler.css";

// CodeFlow is a district of the Mini City: city HUD + login gate + its own 3D scene.
startCity({ service: "compiler", title: "CodeFlow Compiler", accent: "#4a4f55", scene: "compiler" });

createRoot(document.getElementById("root")!).render(<App />);
