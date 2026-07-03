import React from "react";
import ReactDOM from "react-dom/client";
import AppRouter from "./Router"; // <-- your router file
import { VisionUIControllerProvider } from "./context";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <VisionUIControllerProvider>
      <AppRouter />
    </VisionUIControllerProvider>
  </React.StrictMode>
);
