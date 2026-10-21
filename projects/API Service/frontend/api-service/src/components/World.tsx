import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { geocode, getIss, getPlaceWeather, getQuakes } from '../lib/api'
import type { Air, Forecast, GeoPlace, Iss, Quake } from '../lib/api'
import { errorMessage, quakeColor } from '../lib/format'
import { loadCity } from '../lib/city'
import { createGlobe } from '../scene/globe'
import type { Globe } from '../scene/globe'
import './Api.css'

type Now = {
  name?: string
  main?: { temp: number; feels_like: number; humidity: number }
  weather?: { description: string }[]
  wind?: { speed: number }
}

export function World() {
  const globeRef = useRef<Globe | null>(null)
  const [ready, setReady] = useState(false)
  const [quakes, setQuakes] = useState<Quake[]>([])
  const [iss, setIss] = useState<Iss | null>(null)
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('')
  const [place, setPlace] = useState<GeoPlace | null>(null)
  const [now, setNow] = useState<Now | null>(null)
  const [days, setDays] = useState<Forecast[]>([])
  const [air, setAir] = useState<Air | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // 3D stage with orbit controls
  useEffect(() => {
    let cancelled = false
    let dispose = () => {}
    loadCity()
      .then(({ three }) => {
        if (cancelled) return
        const stage = three.createStage(document.body, {
          camera: { pos: [0, 3, 17], look: [0, 0, 0] },
          fog: { color: 0xedeae1, density: 0.003 },
        })
        if (!stage.ok) return
        three.skyDome(stage, 0xf7f5f0, 0xe3dfd4)
        three.particles(stage, { count: 320, color: 0xa29a88, area: [120, 70, 120], size: 0.14, opacity: 0.4, drift: 0.02 })
        const sun = new three.THREE.DirectionalLight(0xfff6e4, 1.7)
        sun.position.set(18, 8, 14)
        stage.scene.add(sun)
        stage.orbit({ min: 7.5, max: 30, autoRotate: true, speed: 0.4 })
        const globe = createGlobe(three, stage, { radius: 5, spin: false })
        globeRef.current = globe
        setReady(true)
        dispose = () => {
          globeRef.current = null
          globe.dispose()
          stage.dispose()
        }
      })
      .catch(() => {
        /* no WebGL / no shared core: the data panels still work */
      })
    return () => {
      cancelled = true
      dispose()
    }
  }, [])

  // earthquakes, refreshed every 5 minutes
  useEffect(() => {
    let alive = true
    const load = () => getQuakes().then((q) => alive && setQuakes(q)).catch(() => {})
    load()
    const t = setInterval(load, 5 * 60 * 1000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [])

  // ISS, every 6 seconds
  useEffect(() => {
    let alive = true
    const load = () => getIss().then((p) => alive && setIss(p)).catch(() => {})
    load()
    const t = setInterval(load, 6000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [])

  useEffect(() => {
    if (!ready || !globeRef.current) return
    globeRef.current.setMarkers(
      'quakes',
      quakes.map((q) => ({
        lat: q.lat,
        lon: q.lon,
        color: quakeColor(q.mag),
        size: 0.04 + Math.max(0, q.mag - 4) * 0.035,
        label: `M${q.mag} — ${q.place}`,
        onClick: () => globeRef.current?.focusOn(q.lat, q.lon),
      })),
    )
  }, [ready, quakes])

  useEffect(() => {
    if (!ready || !globeRef.current) return
    globeRef.current.setMarkers('iss', iss && Number.isFinite(iss.lat) ? [{ lat: iss.lat, lon: iss.lon, color: 0xa9741b, size: 0.14, label: 'International Space Station' }] : [])
  }, [ready, iss])

  async function search(e: FormEvent) {
    e.preventDefault()
    if (!city.trim()) return
    setBusy(true)
    setError('')
    try {
      const places = await geocode(city.trim(), country.trim())
      if (!places.length) {
        setError('No place found with that name.')
        return
      }
      const p = places[0]
      setPlace(p)
      const w = await getPlaceWeather(p.lat, p.lon)
      setNow(w.now)
      setDays(w.days)
      setAir(w.air)
      globeRef.current?.setMarkers('pin', [{ lat: p.lat, lon: p.lon, color: 0xffffff, size: 0.11, label: p.name }])
      globeRef.current?.focusOn(p.lat, p.lon)
    } catch (err) {
      setError(errorMessage(err, 'Could not load that place right now.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <div className="two-col">
        <section className="glass accent">
          <div className="hd">Place weather <small>search anywhere</small></div>
          <div className="bd">
            <form onSubmit={search}>
              <label className="field">City
                <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Chennai" maxLength={80} />
              </label>
              <label className="field">Country code (optional)
                <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. IN" maxLength={2} />
              </label>
              <button className="btn primary block" type="submit" disabled={busy}>{busy ? 'Searching…' : 'Fly there'}</button>
            </form>
            {error && <p className="bad" role="alert">{error}</p>}
            {place && now && (
              <div className="mt">
                <div className="row-between">
                  <strong>📍 {place.name}{place.state ? `, ${place.state}` : ''}, {place.country}</strong>
                  {air && <span className="pill">{air.label ? `Air: ${air.label}` : 'Air: –'}</span>}
                </div>
                <p className="muted cap">{now.weather?.[0]?.description}</p>
                <div className="stats">
                  <div className="glass stat"><div className="k">Temp</div><div className="v">{now.main ? Math.round(now.main.temp) : '–'}°</div></div>
                  <div className="glass stat"><div className="k">Humidity</div><div className="v">{now.main?.humidity ?? '–'}%</div></div>
                  <div className="glass stat"><div className="k">Wind</div><div className="v">{now.wind?.speed ?? '–'}</div><div className="s">m/s</div></div>
                </div>
                <div className="forecast">
                  {days.map((d) => (
                    <div key={d.date}>
                      <div className="muted">{d.date.slice(5)}</div>
                      <div>{Math.round(d.min)}° / {Math.round(d.max)}°</div>
                      <div className="muted">{d.condition}</div>
                      <div className="muted">☔ {d.rainChance}%</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        <div className="mid" />

        <section className="glass">
          <div className="hd">Live Earth <small>drag to rotate</small></div>
          <div className="bd">
            <div className="row-between mb">
              <span className="pill ok">🛰️ ISS</span>
              <span className="muted">{iss && Number.isFinite(iss.lat) ? `${iss.lat.toFixed(1)}°, ${iss.lon.toFixed(1)}°` : 'locating…'}</span>
            </div>
            <div className="muted mb-sm">Earthquakes M4.5+ · last 24 h ({quakes.length})</div>
            {quakes.slice(0, 8).map((q) => (
              <div className="list-row" key={q.id} onClick={() => globeRef.current?.focusOn(q.lat, q.lon)}>
                <span>{q.place}</span>
                <strong>M{q.mag}</strong>
              </div>
            ))}
            {quakes.length === 0 && <div className="empty">No data yet.</div>}
          </div>
        </section>
      </div>
    </div>
  )
}
