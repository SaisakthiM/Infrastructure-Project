import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './telemetry'
import App from './App.jsx'
import { startCity } from './city/startCity'

// Document Intelligence is a district of the Mini City: city HUD + login gate + its own 3D scene.
startCity({ service: 'document', title: 'Document Archive', accent: '#6e7042', scene: 'archive' })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
