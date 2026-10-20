import { useEffect, useState } from 'react'
import { getCrypto, getFx, getStocks } from '../lib/api'
import type { Coin, StockQuote } from '../lib/api'
import { fmtPct } from '../lib/format'
import './Api.css'

type Tab = 'stocks' | 'crypto' | 'fx'

export function Markets() {
  const [tab, setTab] = useState<Tab>('stocks')
  const [stocks, setStocks] = useState<StockQuote[]>([])
  const [coins, setCoins] = useState<Coin[]>([])
  const [fx, setFx] = useState<{ base: string; rates: Record<string, number> } | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    const load = async () => {
      try {
        if (tab === 'stocks') setStocks(await getStocks())
        else if (tab === 'crypto') setCoins(await getCrypto())
        else setFx(await getFx('USD'))
      } catch {
        if (!cancelled) setError('Could not load market data right now.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [tab])

  return (
    <div className="page">
      <div className="glass accent" style={{ maxWidth: 720 }}>
        <div className="hd">
          <span>Markets</span>
          <small>real-world data · delayed</small>
        </div>
        <div className="tabs-row" role="tablist">
          {(['stocks', 'crypto', 'fx'] as Tab[]).map((t) => (
            <button key={t} className={t === tab ? 'on' : ''} onClick={() => setTab(t)}>
              {t === 'fx' ? 'Currencies' : t}
            </button>
          ))}
        </div>
        <div className="bd">
          {loading && <div className="empty">Loading…</div>}
          {error && <div className="bad" role="alert">{error}</div>}

          {!loading && !error && tab === 'stocks' && (
            <table className="tbl">
              <thead><tr><th>Symbol</th><th className="num">Last</th><th className="num">Day</th></tr></thead>
              <tbody>
                {stocks.map((s) => (
                  <tr key={s.symbol}>
                    <td>{s.symbol}</td>
                    <td className="num">${s.close.toFixed(2)}</td>
                    <td className={`num ${(s.changePct ?? 0) >= 0 ? 'up' : 'down'}`}>{fmtPct(s.changePct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {!loading && !error && tab === 'crypto' && (
            <table className="tbl">
              <thead><tr><th>Coin</th><th className="num">USD</th><th className="num">24 h</th></tr></thead>
              <tbody>
                {coins.map((c) => (
                  <tr key={c.id}>
                    <td>{c.id}</td>
                    <td className="num">${c.usd.toLocaleString('en-US')}</td>
                    <td className={`num ${(c.change24h ?? 0) >= 0 ? 'up' : 'down'}`}>{fmtPct(c.change24h)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {!loading && !error && tab === 'fx' && fx && (
            <table className="tbl">
              <thead><tr><th>1 {fx.base} =</th><th className="num">Rate</th></tr></thead>
              <tbody>
                {Object.entries(fx.rates).map(([code, rate]) => (
                  <tr key={code}><td>{code}</td><td className="num">{rate}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
