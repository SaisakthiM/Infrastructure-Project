// Real-world market data from free, key-less providers. Provider URLs can be overridden for testing.
var express = require('express');
var router = express.Router();
const http = require('../lib/http');
const cache = require('../lib/cache');

const STOOQ = process.env.STOOQ_URL || 'https://stooq.com/q/l/';
const COINGECKO = process.env.COINGECKO_URL || 'https://api.coingecko.com/api/v3/simple/price';
const FRANKFURTER = process.env.FRANKFURTER_URL || 'https://api.frankfurter.dev/v1/latest';

const DEFAULT_STOCKS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA'];
const DEFAULT_COINS = ['bitcoin', 'ethereum', 'solana', 'dogecoin'];
const DEFAULT_FX = ['INR', 'EUR', 'GBP', 'JPY'];

function list(raw, fallback, pattern, max) {
  if (raw === undefined || raw === '') return { items: fallback };
  const items = String(raw).split(',').map((s) => s.trim()).filter(Boolean);
  if (items.length === 0 || items.length > max || !items.every((s) => pattern.test(s))) return { error: true };
  return { items };
}

/** Stooq answers CSV: Symbol,Date,Time,Open,High,Low,Close,Volume. Unknown symbols come back as N/D. */
function parseStooq(csv) {
  const lines = String(csv).trim().split(/\r?\n/);
  const out = [];
  lines.slice(1).forEach((line) => {
    const [symbol, date, time, open, high, low, close, volume] = line.split(',');
    const c = Number(close);
    if (!symbol || !Number.isFinite(c)) return;
    const o = Number(open);
    out.push({
      symbol: symbol.replace(/\.US$/i, '').toUpperCase(),
      date,
      time,
      open: o,
      high: Number(high),
      low: Number(low),
      close: c,
      volume: Number(volume) || 0,
      changePct: Number.isFinite(o) && o > 0 ? Math.round(((c - o) / o) * 10000) / 100 : null,
    });
  });
  return out;
}

/* GET /api/markets/stocks/?symbols=AAPL,MSFT */
router.get('/stocks/', async function (req, res) {
  const parsed = list(req.query.symbols, DEFAULT_STOCKS, /^[A-Za-z0-9.^-]{1,12}$/, 10);
  if (parsed.error) return res.status(400).json({ error: 'symbols must be up to 10 comma-separated tickers' });
  const stooqSymbols = parsed.items.map((s) => (s.includes('.') ? s : `${s}.us`).toLowerCase());
  try {
    const quotes = await cache.remember(`stocks:${stooqSymbols.join(',')}`, 60 * 1000, async () => {
      const r = await http.get(`${STOOQ}?s=${encodeURIComponent(stooqSymbols.join(','))}&f=sd2t2ohlcv&h&e=csv`);
      return parseStooq(r.data);
    });
    res.json({ source: 'stooq.com', delayed: true, quotes });
  } catch (err) {
    http.sendUpstreamError(res, err);
  }
});

/* GET /api/markets/crypto/?ids=bitcoin,ethereum */
router.get('/crypto/', async function (req, res) {
  const parsed = list(req.query.ids, DEFAULT_COINS, /^[a-z0-9-]{1,40}$/, 10);
  if (parsed.error) return res.status(400).json({ error: 'ids must be up to 10 comma-separated CoinGecko ids' });
  try {
    const data = await cache.remember(`crypto:${parsed.items.join(',')}`, 60 * 1000, async () => {
      const r = await http.get(`${COINGECKO}?ids=${parsed.items.join(',')}&vs_currencies=usd,inr&include_24hr_change=true`);
      return r.data;
    });
    const coins = Object.keys(data || {}).map((id) => ({
      id,
      usd: data[id].usd,
      inr: data[id].inr,
      change24h: data[id].usd_24h_change !== undefined ? Math.round(data[id].usd_24h_change * 100) / 100 : null,
    }));
    res.json({ source: 'coingecko.com', coins });
  } catch (err) {
    http.sendUpstreamError(res, err);
  }
});

/* GET /api/markets/fx/?base=USD&symbols=INR,EUR */
router.get('/fx/', async function (req, res) {
  const base = String(req.query.base || 'USD').toUpperCase();
  if (!/^[A-Z]{3}$/.test(base)) return res.status(400).json({ error: 'base must be a 3-letter currency code' });
  const parsed = list(req.query.symbols ? String(req.query.symbols).toUpperCase() : undefined, DEFAULT_FX, /^[A-Z]{3}$/, 12);
  if (parsed.error) return res.status(400).json({ error: 'symbols must be up to 12 comma-separated currency codes' });
  try {
    const data = await cache.remember(`fx:${base}:${parsed.items.join(',')}`, 30 * 60 * 1000, async () => {
      const r = await http.get(`${FRANKFURTER}?base=${base}&symbols=${parsed.items.join(',')}`);
      return r.data;
    });
    res.json({ source: 'frankfurter.dev', base: data.base || base, date: data.date || null, rates: data.rates || {} });
  } catch (err) {
    http.sendUpstreamError(res, err);
  }
});

module.exports = router;
module.exports.parseStooq = parseStooq;
