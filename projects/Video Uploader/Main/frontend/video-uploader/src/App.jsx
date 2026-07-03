import { Routes, Route } from "react-router-dom"
import HomePage from "./components/HomePage.jsx"
import Upload from "./components/Upload.jsx"
import Download from "./components/Downlaod.jsx"
import Remove from "./components/Remove.jsx"

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/upload" element={<Upload />} />
      <Route path="/download" element={<Download />} />
      <Route path="/remove" element={<Remove />} />
    </Routes>
  )
}
