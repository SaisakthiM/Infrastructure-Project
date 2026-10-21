import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import { startCity } from "./city/startCity";
import "./styles/index.css";
import "./styles/notes.css";

// The Reading Room is a district of the Mini City: city HUD + login gate + its own 3D scene.
// requireLogin:false — Notes still has its own user table + JWT endpoint, so the shared city gate
// must not ask for a second sign-in on top of the district's own login. Remove this once the
// notes backend verifies citizens against the bank (see Grocery Store/market/city_identity.py).
startCity({ service: "notes", title: "The Reading Room", accent: "#8a6b2f", scene: "library", requireLogin: false });

createRoot(document.getElementById("root")!).render(<App />);
