import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";
import "./styles/whisper-city.css";

// Start city layer (non-blocking: Whisper still works if city-core is absent)
const cityUrl = "/city-core/city-app.js";
// No `accent` on purpose: city-app.js falls back to DISTRICTS['whisper'] and resolves the
// registry hex #0f7a8c (D-11) itself. A literal here would drift from the district registry.
import(/* @vite-ignore */ cityUrl)
  .then((m: any) => m.startCityApp({ service: "whisper", title: "Whisper Chat", scene: "chat", requireLogin: false }))
  .catch(() => {});

createRoot(document.getElementById("root")!).render(<App />);
