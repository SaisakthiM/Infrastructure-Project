import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { loadCity } from '../lib/city'
import { createGlobe } from '../scene/globe'
import './Api.css'

/** Mounts the shared bank HUD once for every page of this district. */
export function CityHud() {
  useEffect(() => {
    let off = () => {}
    let cancelled = false
    loadCity()
      .then(({ City }) => {
        if (cancelled) return
        City.mountHud({ service: 'api', title: 'API & Markets', accent: '#4a7fb5' })
        off = City.on(() => {})
      })
      .catch(() => {
        /* no shared core (tests, offline): the page still works without the HUD */
      })
    return () => {
      cancelled = true
      off()
    }
  }, [])
  return null
}

export function DistrictNav() {
  const link = ({ isActive }: { isActive: boolean }) => (isActive ? 'on' : '')
  return (
    <nav className="district-nav glass" aria-label="API sections">
      <NavLink to="/" end className={link}>Home</NavLink>
      <NavLink to="/weather" className={link}>Weather</NavLink>
      <NavLink to="/geo/cod" className={link}>Geocoding</NavLink>
      <NavLink to="/markets" className={link}>Markets</NavLink>
      <NavLink to="/world" className={link}>World</NavLink>
      <NavLink to="/exchange" className={link}>Exchange</NavLink>
    </nav>
  )
}

/** A slowly turning Earth behind the page (Home, Weather, Geocoding). */
export function GlobeBackdrop() {
  useEffect(() => {
    let cancelled = false
    let dispose = () => {}
    loadCity()
      .then(({ three }) => {
        if (cancelled) return
        const stage = three.createStage(document.body, {
          camera: { pos: [0, 1.5, 17], look: [0, 0, 0] },
          fog: { color: 0x04070f, density: 0.004 },
          parallax: 1.2,
        })
        if (!stage.ok) return
        three.skyDome(stage, 0x050b1d, 0x03050c)
        three.particles(stage, { count: 500, color: 0xcfe3ff, area: [120, 70, 120], size: 0.22, opacity: 0.8, drift: 0.02 })
        const sun = new three.THREE.DirectionalLight(0xfff4e0, 2.1)
        sun.position.set(18, 8, 14)
        stage.scene.add(sun)
        const globe = createGlobe(three, stage, { radius: 5.2, spin: true })
        globe.group.position.x = 5.5
        dispose = () => {
          globe.dispose()
          stage.dispose()
        }
      })
      .catch(() => {
        /* no WebGL / no shared core: plain page */
      })
    return () => {
      cancelled = true
      dispose()
    }
  }, [])
  return null
}
