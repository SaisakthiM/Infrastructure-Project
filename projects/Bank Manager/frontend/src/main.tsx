import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import { startCity } from "./city/startCity";
import "./styles/index.css";
import "./styles/bank.css";

// The bank is the city's identity provider: HUD + vault scene, but no second gate (its own sign-in IS the city login).
startCity({ service: "bank", title: "City Bank", accent: "#d8b44b", scene: "vault", requireLogin: false });

createRoot(document.getElementById("root")!).render(<App />);
