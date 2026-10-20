import { BrowserRouter, Route, Routes } from "react-router-dom"
import { Home } from "./components/Home"
import { Weather } from "./components/Weather"
import { GeoCod } from "./components/GeoCod"
import { Markets } from "./components/Markets"
import { World } from "./components/World"
import { Exchange } from "./components/Exchange"
import { CityHud, DistrictNav, GlobeBackdrop } from "./components/Backdrops"


export default function App() {
  return (
    <BrowserRouter basename="/api-service">
      <CityHud />
      <DistrictNav />
      <Routes>
        <Route path="/" element={<><GlobeBackdrop /><Home /></>}></Route>
        <Route path="/weather" element={<><GlobeBackdrop /><Weather /></>}></Route>
        <Route path="/geo/cod" element={<><GlobeBackdrop /><GeoCod /></>}></Route>
        <Route path="/markets" element={<Markets />}></Route>
        <Route path="/world" element={<World />}></Route>
        <Route path="/exchange" element={<Exchange />}></Route>
      </Routes>
    </BrowserRouter>
  )
}
