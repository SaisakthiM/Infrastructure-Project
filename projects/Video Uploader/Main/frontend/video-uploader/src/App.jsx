import { Routes, Route } from "react-router-dom"
import ModernVideoHub from "./components/ModernVideoHub.jsx"
import Upload from "./components/Upload.jsx"
import Download from "./components/Downlaod.jsx"
import Remove from "./components/Remove.jsx"

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<ModernVideoHub />} />
      <Route path="/upload" element={<Upload />} />
      <Route path="/download" element={<Download />} />
      <Route path="/remove" element={<Remove />} />
    </Routes>
  )
}

