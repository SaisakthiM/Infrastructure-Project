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
        City.mountHud({ service: 'api', title: 'API & Markets', accent: '#3d4e66' })
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

/** A slowly turning Earth behind the page (Home, Weather, Geocoding), lit like the daylight maquette. */
export function GlobeBackdrop() {
  useEffect(() => {
    let cancelled = false
    let dispose = () => {}
    loadCity()
      .then(({ three }) => {
        if (cancelled) return
        const stage = three.createStage(document.body, {
          camera: { pos: [0, 1.5, 17], look: [0, 0, 0] },
          fog: { color: 0xedeae1, density: 0.004 },
          parallax: 1.2,
        })
        if (!stage.ok) return
        three.skyDome(stage, 0xf7f5f0, 0xe3dfd4)
        three.particles(stage, { count: 320, color: 0xa29a88, area: [120, 70, 120], size: 0.14, opacity: 0.4, drift: 0.02 })
        const sun = new three.THREE.DirectionalLight(0xfff6e4, 1.7)
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
