import { useCallback, useEffect, useRef, useState } from 'react'
import { loadCity } from '../lib/city'
import {
  claimEarnings, downloadUrl, listMedia, recordView, removeMedia, streamUrl, toggleLike, uploadMedia,
} from '../lib/api'
import { formatBytes, KIND_ICON, MAX_UPLOAD_BYTES, timeAgo } from '../lib/format'
import { buildMediaScene } from '../scene/mediaScene'

const FILTERS = ['all', 'video', 'image', 'audio', 'doc', 'other']
const EMPTY = { files: [], claimable: 0, user: null, viewsPerRupee: 5, rupeesPerLike: 3 }

export default function MediaDistrict() {
  const [city, setCity] = useState(null)
  const [snap, setSnap] = useState(null)
  const [data, setData] = useState(EMPTY)
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState(null)
  const [upload, setUpload] = useState(null)
  const [over, setOver] = useState(false)
  const [error, setError] = useState('')
  const sceneRef = useRef(null)
  const fileInput = useRef(null)
  const filterRef = useRef('all')
  const cityRef = useRef(null)

  filterRef.current = filter
  cityRef.current = city

  const headers = useCallback(() => (cityRef.current ? cityRef.current.City.identityHeaders() : {}), [])

  const refresh = useCallback(async () => {
    try {
      const next = await listMedia(headers())
      setData(next)
      setError('')
    } catch (e) {
      setError(e.message)
    }
  }, [headers])

  // boot: shared city modules, HUD, 3D stage
  useEffect(() => {
    let stage
    let cancelled = false
    let off = () => {}
    loadCity().then((c) => {
      if (cancelled) return
      setCity(c)
      c.City.mountHud({ service: 'media', title: 'Media District', accent: '#d6537a' })
      off = c.City.on(setSnap)
      stage = c.three.createStage(document.body, { camera: { pos: [0, 4.2, 9], look: [0, 4.2, -6] }, fog: { color: 0x07050c, density: 0.014 }, parallax: 1.1 })
      if (stage.ok) {
        sceneRef.current = buildMediaScene({ stage, three: c.three, onSelect: (file) => openFile(file) })
      }
    })
    return () => {
      cancelled = true
      off()
      sceneRef.current?.dispose()
      stage?.dispose?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // refresh on login changes and every 30 s
  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 30000)
    return () => clearInterval(t)
  }, [refresh, snap?.loggedIn])

  // keep the 3D gallery in sync with data + filter
  useEffect(() => {
    const files = filter === 'all' ? data.files : data.files.filter((f) => f.kind === filter)
    sceneRef.current?.setFiles(files)
  }, [data, filter, city])

  function openFile(file) {
    setSelected(file)
    recordView(file.name).then((v) => {
      if (v) setData((d) => ({ ...d, files: d.files.map((f) => (f.name === file.name ? { ...f, views: v.views, likes: v.likes } : f)) }))
    })
  }

  async function onFiles(list) {
    const file = list && list[0]
    if (!file || !city) return
    if (file.size > MAX_UPLOAD_BYTES) return city.City.toast(`That file is ${formatBytes(file.size)}; the limit is 200 MB.`, 'bad')
    setUpload({ name: file.name, pct: 0 })
    try {
      await uploadMedia(file, headers(), (pct) => setUpload({ name: file.name, pct }))
      city.City.toast(snap?.loggedIn ? 'Uploaded — you earn from views and likes.' : 'Uploaded anonymously (log in to earn from it).', 'ok')
      await refresh()
    } catch (e) {
      city.City.toast(e.message, 'bad')
    } finally {
      setUpload(null)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  async function like(file) {
    if (!snap?.loggedIn) return city.City.openLogin()
    try {
      const res = await toggleLike(file.name, headers())
      setSelected((s) => (s ? { ...s, likes: res.likes, likedByMe: res.liked } : s))
      refresh()
    } catch (e) {
      city.City.toast(e.message, 'bad')
    }
  }

  async function claim() {
    if (!snap?.loggedIn) return city.City.openLogin()
    try {
      const { amount } = await claimEarnings(headers())
      if (!amount) return city.City.toast('Nothing to claim yet.', 'info')
      const paid = await city.City.earn('media', amount, 'Creator earnings')
      city.City.toast(paid.ok ? `${city.City.money(amount)} added to your bank account.` : paid.message, paid.ok ? 'ok' : 'warn')
      refresh()
    } catch (e) {
      city.City.toast(e.message, 'bad')
    }
  }

  async function remove(file) {
    if (!window.confirm(`Delete ${file.name}?`)) return
    try {
      await removeMedia(file.name, headers())
      setSelected(null)
      city.City.toast('File removed.', 'ok')
      refresh()
    } catch (e) {
      city.City.toast(e.message, 'bad')
    }
  }

  const files = filter === 'all' ? data.files : data.files.filter((f) => f.kind === filter)

  return (
    <div className="city-ui">
      <div className="media-grid">
        <section className="glass accent">
          <div className="hd">Upload <small>up to 200 MB</small></div>
          <div className="bd">
            <div
              className={`drop${over ? ' over' : ''}`}
              onClick={() => fileInput.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setOver(true) }}
              onDragLeave={() => setOver(false)}
              onDrop={(e) => { e.preventDefault(); setOver(false); onFiles(e.dataTransfer.files) }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') fileInput.current?.click() }}
            >
              {upload ? (
                <>
                  <div>{upload.name}</div>
                  <div className="progress"><i style={{ width: `${upload.pct}%` }} /></div>
                  <small className="muted">{upload.pct}%</small>
                </>
              ) : (
                <>Drop a video, image, song or document here<br /><small className="muted">or click to browse</small></>
              )}
            </div>
            <input ref={fileInput} type="file" hidden onChange={(e) => onFiles(e.target.files)} />
          </div>

          <div className="hd">Library <small>{files.length} items</small></div>
          <div className="bd">
            <div className="chips" style={{ marginBottom: 10 }}>
              {FILTERS.map((f) => (
                <button key={f} className={`btn sm${f === filter ? ' primary' : ''}`} onClick={() => setFilter(f)}>{f}</button>
              ))}
            </div>
            {error && <div className="bad" role="alert">{error}</div>}
            <div className="file-list">
              {files.length === 0 && !error && <div className="empty">Nothing here yet — be the first to upload.</div>}
              {files.map((f) => (
                <div key={f.name} className="file-row" onClick={() => openFile(f)}>
                  <span>{KIND_ICON[f.kind]}</span>
                  <div style={{ minWidth: 0 }}>
                    <div className="name">{f.name}</div>
                    <small>{formatBytes(f.size)} · {timeAgo(f.modified)} · {f.creator}</small>
                  </div>
                  <small>👁 {f.views} ♥ {f.likes}</small>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="mid" />

        <section className="glass">
          <div className="hd">Creator earnings</div>
          <div className="bd">
            <div className="earn">{city ? city.City.money(data.claimable) : '₹0'}</div>
            <p className="muted">
              Earn ₹1 per {data.viewsPerRupee} views and ₹{data.rupeesPerLike} per like on files you uploaded while logged in.
            </p>
            <button className="btn primary block" onClick={claim} disabled={snap?.loggedIn && data.claimable === 0}>
              {snap?.loggedIn ? 'Claim to bank' : 'Log in to earn'}
            </button>
          </div>
        </section>
      </div>

      {selected && (
        <div className="viewer" onClick={() => setSelected(null)}>
          <div className="glass viewer-card accent" onClick={(e) => e.stopPropagation()}>
            <div className="hd">
              <span>{KIND_ICON[selected.kind]} {selected.name}</span>
              <button className="btn sm" onClick={() => setSelected(null)}>Close</button>
            </div>
            <div className="bd">
              {selected.kind === 'video' && <video src={streamUrl(selected.name)} controls autoPlay playsInline />}
              {selected.kind === 'image' && <img src={streamUrl(selected.name)} alt={selected.name} />}
              {selected.kind === 'audio' && <audio src={streamUrl(selected.name)} controls autoPlay />}
              {selected.kind === 'doc' && selected.name.toLowerCase().endsWith('.pdf') && (
                <div className="empty">
                  <a className="btn primary" href={streamUrl(selected.name)} target="_blank" rel="noopener noreferrer">Open PDF in a new tab</a>
                </div>
              )}
              {(selected.kind === 'other' || (selected.kind === 'doc' && !selected.name.toLowerCase().endsWith('.pdf'))) && (
                <div className="empty">No preview for this file type. Use download.</div>
              )}
              <div className="btn-row" style={{ marginTop: 14 }}>
                <button className="btn" onClick={() => like(selected)}>{selected.likedByMe ? '♥ Liked' : '♡ Like'} · {selected.likes}</button>
                <a className="btn" href={downloadUrl(selected.name)}>Download</a>
                <button className="btn danger" onClick={() => remove(selected)}>Delete</button>
                <span className="muted" style={{ alignSelf: 'center' }}>
                  {formatBytes(selected.size)} · by {selected.creator} · 👁 {selected.views}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
