import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import "./styles.css";
import './telemetry' 
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
        {/* ✅ use this */}
      <App />
    
  </StrictMode>
);
