import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './telemetry.js';
import './index.css';
import './city-skin.css';

// Start city layer
const cityUrl = "/city-core/city-app.js";
import(/* @vite-ignore */ cityUrl)
  .then((m) => m.startCityApp({ service: "social", title: "Nexus Social", accent: "#9b7bff", scene: "social", requireLogin: false }))
  .catch(() => {});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
