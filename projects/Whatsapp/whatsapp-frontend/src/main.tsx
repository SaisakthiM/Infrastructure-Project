import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";
import "./styles/whisper-city.css";

// Start city layer (non-blocking: Whisper still works if city-core is absent)
const cityUrl = "/city-core/city-app.js";
import(/* @vite-ignore */ cityUrl)
  .then((m: any) => m.startCityApp({ service: "whisper", title: "Whisper Chat", accent: "#00e676", scene: "chat", requireLogin: false }))
  .catch(() => {});

createRoot(document.getElementById("root")!).render(<App />);
