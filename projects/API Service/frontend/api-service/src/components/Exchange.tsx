import { useCallback, useEffect, useRef, useState } from 'react'
import { buy, getExchangeQuotes, getLeaders, getPortfolio, requestOrderQuote, sell } from '../lib/api'
import type { Portfolio, Quote } from '../lib/api'
import { errorMessage, fmtMoney, fmtPct } from '../lib/format'
import { loadCity } from '../lib/city'
import type { CityApi } from '../lib/city'
import { buildExchangeScene } from '../scene/exchangeScene'
import './Api.css'

type Scene = ReturnType<typeof buildExchangeScene>

export function Exchange() {
  const [city, setCity] = useState<CityApi | null>(null)
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [selected, setSelected] = useState('BANK')
  const [qty, setQty] = useState(1)
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null)
  const [leaders, setLeaders] = useState<{ user: string; value: number }[]>([])
  const [loggedIn, setLoggedIn] = useState(false)
  const [busy, setBusy] = useState(false)
  const sceneRef = useRef<Scene | null>(null)
  const cityRef = useRef<CityApi | null>(null)

  // 3D stage
  useEffect(() => {
    let cancelled = false
    let dispose = () => {}
    let off = () => {}
    loadCity()
      .then(({ City, three }) => {
        if (cancelled) return
        cityRef.current = City
        setCity(City)
        off = City.on((s) => setLoggedIn(s.loggedIn))
        const stage = three.createStage(document.body, {
          camera: { pos: [0, 7, 19], look: [0, 3, 0] },
          fog: { color: 0x040a10, density: 0.012 },
        })
        if (!stage.ok) return
        stage.orbit({ target: [0, 3, 0], min: 9, max: 34, maxPolar: Math.PI * 0.49 })
        const scene = buildExchangeScene({ stage, three, onSelect: (symbol) => setSelected(symbol) })
        sceneRef.current = scene
        dispose = () => {
          sceneRef.current = null
          scene.dispose()
          stage.dispose()
        }
      })
      .catch(() => {
        /* no WebGL / no shared core: the trading panel still works */
      })
    return () => {
      cancelled = true
      off()
      dispose()
    }
  }, [])

  const refreshQuotes = useCallback(async () => {
    try {
      const q = await getExchangeQuotes()
      setQuotes(q)
      sceneRef.current?.update(q)
    } catch {
      /* keep showing the last prices */
    }
  }, [])

  const refreshPortfolio = useCallback(async () => {
    const c = cityRef.current
    if (!c || !c.snapshot().loggedIn) {
      setPortfolio(null)
      return
    }
    try {
      setPortfolio(await getPortfolio(c.identityHeaders()))
    } catch {
      setPortfolio(null)
    }
  }, [])

  useEffect(() => {
    refreshQuotes()
    const t = setInterval(refreshQuotes, 5000)
    return () => clearInterval(t)
  }, [refreshQuotes])

  useEffect(() => {
    getLeaders().then(setLeaders).catch(() => {})
  }, [portfolio])

  useEffect(() => {
    refreshPortfolio()
  }, [loggedIn, city, refreshPortfolio])

  // the 3D scene may build before the first prices arrive
  useEffect(() => {
    sceneRef.current?.update(quotes)
  }, [quotes, city])

  useEffect(() => {
    sceneRef.current?.select(selected)
  }, [selected, quotes.length])

  const current = quotes.find((q) => q.symbol === selected)
  const cost = current ? current.price * qty : 0

  async function onBuy() {
    const c = cityRef.current
    if (!c || !current) return
    if (!c.snapshot().loggedIn) return c.openLogin()
    setBusy(true)
    try {
      const headers = c.identityHeaders()
      const q = await requestOrderQuote(selected, qty, headers)
      const paid = await c.spend('exchange', q.total, `Buy ${q.qty} × ${q.symbol}`)
      if (!paid.ok) {
        c.toast(paid.message || 'Payment failed.', 'bad')
        return
      }
      try {
        await buy(q.quoteId, headers)
        c.toast(`Bought ${q.qty} × ${q.symbol} for ${fmtMoney(q.total)}.`, 'ok')
      } catch (err) {
        await c.earn('exchange', q.total, 'Refund: order was not filled')
        c.toast(`${errorMessage(err, 'The exchange rejected the order.')} You were refunded.`, 'bad')
      }
    } catch (err) {
      c.toast(errorMessage(err, 'Could not get a price quote.'), 'bad')
    } finally {
      setBusy(false)
      refreshQuotes()
      refreshPortfolio()
    }
  }

  async function onSell() {
    const c = cityRef.current
    if (!c || !current) return
    if (!c.snapshot().loggedIn) return c.openLogin()
    setBusy(true)
    try {
      const r = await sell(selected, qty, c.identityHeaders())
      const paid = await c.earn('exchange', r.proceeds, `Sell ${r.qty} × ${r.symbol}`)
      c.toast(paid.ok ? `Sold ${r.qty} × ${r.symbol} for ${fmtMoney(r.proceeds)}.` : paid.message || 'Sold, but the payout failed.', paid.ok ? 'ok' : 'warn')
    } catch (err) {
      c.toast(errorMessage(err, 'Could not sell.'), 'bad')
    } finally {
      setBusy(false)
      refreshQuotes()
      refreshPortfolio()
    }
  }

  return (
    <div className="page">
      <div className="two-col">
        <section className="glass accent">
          <div className="hd">Mini City Exchange <small>prices tick every 5 s</small></div>
          <div className="bd">
            {quotes.map((q) => (
              <div key={q.symbol} className="list-row" onClick={() => setSelected(q.symbol)} style={q.symbol === selected ? { background: 'rgba(255,255,255,.06)' } : undefined}>
                <span><strong>{q.symbol}</strong> <span className="muted">{q.name}</span></span>
                <span>
                  {fmtMoney(q.price)} <span className={q.change >= 0 ? 'up' : 'down'}>{fmtPct(q.change)}</span>
                </span>
              </div>
            ))}
            {quotes.length === 0 && <div className="empty">Loading prices…</div>}
          </div>
        </section>

        <div className="mid" />

        <section className="glass">
          <div className="hd">Trade <small>{selected}</small></div>
          <div className="bd">
            <label className="field">Shares
              <input
                type="number"
                min={1}
                max={1000}
                value={qty}
                onChange={(e) => setQty(Math.max(1, Math.min(1000, Math.floor(Number(e.target.value)) || 1)))}
              />
            </label>
            <p className="muted">Estimated {fmtMoney(cost)} at {current ? fmtMoney(current.price) : '–'} per share. Price is locked for 20 s when you press Buy.</p>
            <div className="btn-row">
              <button className="btn primary" onClick={onBuy} disabled={busy || !current}>Buy</button>
              <button className="btn" onClick={onSell} disabled={busy || !current}>Sell</button>
            </div>
          </div>

          <div className="hd">Portfolio <small>{portfolio ? fmtMoney(portfolio.value) : 'log in'}</small></div>
          <div className="bd">
            {!loggedIn && <div className="empty">Log in to trade.</div>}
            {loggedIn && portfolio && portfolio.positions.length === 0 && <div className="empty">No shares yet.</div>}
            {portfolio && portfolio.positions.length > 0 && (
              <table className="tbl">
                <thead><tr><th>Co.</th><th className="num">Qty</th><th className="num">P/L</th></tr></thead>
                <tbody>
                  {portfolio.positions.map((p) => (
                    <tr key={p.symbol} onClick={() => setSelected(p.symbol)}>
                      <td>{p.symbol}</td>
                      <td className="num">{p.qty}</td>
                      <td className={`num ${p.pnl >= 0 ? 'up' : 'down'}`}>{fmtMoney(p.pnl)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {portfolio && <p className="muted">Realised: {fmtMoney(portfolio.realized)} · {portfolio.trades} trades</p>}
          </div>

          {leaders.length > 0 && (
            <>
              <div className="hd">Richest investors</div>
              <div className="bd">
                {leaders.slice(0, 5).map((l, i) => (
                  <div className="list-row" key={l.user}><span>{i + 1}. {l.user}</span><strong>{fmtMoney(l.value)}</strong></div>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
