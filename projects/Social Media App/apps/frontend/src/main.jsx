import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './telemetry.js';
import './index.css';
import './city-skin.css';

// Start city layer
const cityUrl = "/city-core/city-app.js";
// Accent is deliberately omitted: city-app.js resolves D-06's #4a5aa6 from its own DISTRICTS registry (THEME.md §1).
import(/* @vite-ignore */ cityUrl)
  .then((m) => m.startCityApp({ service: "social", title: "Nexus Social", scene: "social", requireLogin: false }))
  .catch(() => {});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
