import { BrowserRouter, Route, Routes } from "react-router-dom"
import { Home } from "./components/Home"
import { Weather } from "./components/Weather"
import { GeoCod } from "./components/GeoCod"


export default function App() {
  return (
    <BrowserRouter basename="/api-service">
    <Routes>
      <Route path="/" element={<Home></Home>}></Route>
      <Route path="/weather" element={<Weather></Weather>}></Route>
      <Route path="/geo/cod" element={<GeoCod></GeoCod>}></Route>
    </Routes>
    </BrowserRouter>
  )
}