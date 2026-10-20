import axios from 'axios'

// gateway: /api-service/api/ -> backend root, backend routes live under /api/...
export const BASE = '/api-service/api/api'

export type Headers = Record<string, string>

export type Quote = { symbol: string; name: string; price: number; change: number; history: number[] }
export type StockQuote = { symbol: string; close: number; open: number; high: number; low: number; changePct: number | null; date: string }
export type Coin = { id: string; usd: number; inr: number; change24h: number | null }
export type Quake = { id: string; mag: number; place: string; time: number; lat: number; lon: number; depth: number }
export type Iss = { lat: number; lon: number; timestamp?: number }
export type Forecast = { date: string; min: number; max: number; rainChance: number; condition: string }
export type Air = { aqi: number | null; label: string }
export type GeoPlace = { name: string; state?: string; country: string; lat: number; lon: number }
export type Position = { symbol: string; qty: number; avgCost: number; price: number; value: number; pnl: number }
export type Portfolio = { user: string; positions: Position[]; value: number; realized: number; trades: number }
export type OrderQuote = { quoteId: string; symbol: string; qty: number; price: number; total: number; expiresIn: number }

export async function getExchangeQuotes(): Promise<Quote[]> {
  const res = await axios.get(`${BASE}/exchange/quotes/`)
  return res.data.quotes
}

export async function getStocks(symbols?: string): Promise<StockQuote[]> {
  const res = await axios.get(`${BASE}/markets/stocks/`, { params: symbols ? { symbols } : undefined })
  return res.data.quotes
}

export async function getCrypto(): Promise<Coin[]> {
  const res = await axios.get(`${BASE}/markets/crypto/`)
  return res.data.coins
}

export async function getFx(base = 'USD'): Promise<{ base: string; date: string | null; rates: Record<string, number> }> {
  const res = await axios.get(`${BASE}/markets/fx/`, { params: { base } })
  return res.data
}

export async function getQuakes(): Promise<Quake[]> {
  const res = await axios.get(`${BASE}/world/quakes/`)
  return res.data.quakes
}

export async function getIss(): Promise<Iss> {
  const res = await axios.get(`${BASE}/world/iss/`)
  return res.data
}

export async function geocode(city: string, country = ''): Promise<GeoPlace[]> {
  const res = await axios.get(`${BASE}/geo/cod/`, { params: { city, country_code: country } })
  return res.data
}

export async function getPlaceWeather(lat: number, lon: number) {
  const [now, forecast, air] = await Promise.all([
    axios.get(`${BASE}/weather/`, { params: { lat, lon } }),
    axios.get(`${BASE}/weather/forecast/`, { params: { lat, lon } }),
    axios.get(`${BASE}/weather/air/`, { params: { lat, lon } }),
  ])
  return { now: now.data, days: forecast.data.days as Forecast[], air: air.data as Air }
}

export async function requestOrderQuote(symbol: string, qty: number, headers: Headers): Promise<OrderQuote> {
  const res = await axios.post(`${BASE}/exchange/quote/`, { symbol, qty }, { headers })
  return res.data
}

export async function buy(quoteId: string, headers: Headers) {
  const res = await axios.post(`${BASE}/exchange/buy/`, { quoteId }, { headers })
  return res.data as { ok: boolean; symbol: string; qty: number; price: number; total: number }
}

export async function sell(symbol: string, qty: number, headers: Headers) {
  const res = await axios.post(`${BASE}/exchange/sell/`, { symbol, qty }, { headers })
  return res.data as { ok: boolean; symbol: string; qty: number; price: number; proceeds: number }
}

export async function getPortfolio(headers: Headers): Promise<Portfolio> {
  const res = await axios.get(`${BASE}/exchange/portfolio/`, { headers })
  return res.data
}

export async function getLeaders(): Promise<{ user: string; value: number }[]> {
  const res = await axios.get(`${BASE}/exchange/leaderboard/`)
  return res.data.leaders
}
