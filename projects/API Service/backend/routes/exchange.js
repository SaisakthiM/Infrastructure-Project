// Mini City Exchange. Money moves through the bank in the browser (City.spend / City.earn); this service
// owns prices, quotes and portfolios and verifies the citizen with the bank before touching them.
var express = require('express');
var router = express.Router();
const crypto = require('crypto');
const engine = require('../lib/exchangeEngine');
const store = require('../lib/store');
const { requireCitizen } = require('../lib/cityAuth');
const { limit } = require('../lib/rate');

const MAX_QTY = 1000;
const MAX_POSITION = 5000;
const QUOTE_TTL_MS = 20 * 1000;
const quotes = new Map(); // quoteId -> { user, symbol, qty, price, total, exp }

function portfolio(user) {
  const all = store.get().portfolios;
  if (!all[user]) all[user] = { positions: {}, realized: 0, trades: 0 };
  return all[user];
}

function readOrder(body) {
  const symbol = String((body && body.symbol) || '').toUpperCase();
  const qty = Number(body && body.qty);
  if (!engine.bySymbol(symbol)) return { error: 'Unknown symbol' };
  if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) return { error: `Quantity must be a whole number from 1 to ${MAX_QTY}` };
  return { symbol, qty };
}

function pruneQuotes() {
  const now = Date.now();
  for (const [id, q] of quotes) if (q.exp < now) quotes.delete(id);
}

function valueOf(p) {
  return Object.entries(p.positions).reduce((sum, [sym, pos]) => sum + engine.price(sym) * pos.qty, 0);
}

/* GET /api/exchange/quotes/ — public */
router.get('/quotes/', (req, res) => {
  res.json({ market: 'Mini City Exchange', quotes: engine.quotes() });
});

/* POST /api/exchange/quote {symbol, qty} -> a price held for 20 s. Pay this total, then call /buy with the id. */
router.post('/quote/', requireCitizen, limit({ max: 40 }), (req, res) => {
  const order = readOrder(req.body);
  if (order.error) return res.status(400).json({ error: order.error });
  const held = (portfolio(req.citizen).positions[order.symbol] || { qty: 0 }).qty;
  if (held + order.qty > MAX_POSITION) return res.status(409).json({ error: `Position limit is ${MAX_POSITION} shares per company.` });

  pruneQuotes();
  const price = engine.price(order.symbol);
  const id = crypto.randomUUID();
  quotes.set(id, { user: req.citizen, symbol: order.symbol, qty: order.qty, price, total: price * order.qty, exp: Date.now() + QUOTE_TTL_MS });
  res.json({ quoteId: id, symbol: order.symbol, qty: order.qty, price, total: price * order.qty, expiresIn: QUOTE_TTL_MS / 1000 });
});

/* POST /api/exchange/buy {quoteId} — executes at the quoted price; the client has already paid the bank */
router.post('/buy/', requireCitizen, limit({ max: 40 }), (req, res) => {
  const q = quotes.get(req.body && req.body.quoteId);
  if (!q || q.user !== req.citizen) return res.status(404).json({ error: 'Quote not found.' });
  quotes.delete(req.body.quoteId);
  if (q.exp < Date.now()) return res.status(410).json({ error: 'That quote expired.' });

  const p = portfolio(req.citizen);
  const pos = p.positions[q.symbol] || { qty: 0, cost: 0 };
  pos.qty += q.qty;
  pos.cost += q.total;
  p.positions[q.symbol] = pos;
  p.trades += 1;
  engine.applyTrade(q.symbol, q.qty, 'buy');
  store.save();
  res.status(201).json({ ok: true, symbol: q.symbol, qty: q.qty, price: q.price, total: q.total });
});

/* POST /api/exchange/sell {symbol, qty} — executes now; the client credits `proceeds` to the bank */
router.post('/sell/', requireCitizen, limit({ max: 40 }), (req, res) => {
  const order = readOrder(req.body);
  if (order.error) return res.status(400).json({ error: order.error });
  const p = portfolio(req.citizen);
  const pos = p.positions[order.symbol];
  if (!pos || pos.qty < order.qty) return res.status(409).json({ error: 'You do not own that many shares.' });

  const price = engine.price(order.symbol);
  const proceeds = price * order.qty;
  const avg = pos.cost / pos.qty;
  p.realized += Math.round(proceeds - avg * order.qty);
  pos.cost = Math.round(pos.cost - avg * order.qty);
  pos.qty -= order.qty;
  if (pos.qty === 0) delete p.positions[order.symbol];
  p.trades += 1;
  engine.applyTrade(order.symbol, order.qty, 'sell');
  store.save();
  res.json({ ok: true, symbol: order.symbol, qty: order.qty, price, proceeds });
});

/* GET /api/exchange/portfolio/ */
router.get('/portfolio/', requireCitizen, (req, res) => {
  const p = portfolio(req.citizen);
  const positions = Object.entries(p.positions).map(([symbol, pos]) => {
    const price = engine.price(symbol);
    const value = price * pos.qty;
    return { symbol, qty: pos.qty, avgCost: Math.round((pos.cost / pos.qty) * 100) / 100, price, value, pnl: value - pos.cost };
  });
  res.json({ user: req.citizen, positions, value: valueOf(p), realized: p.realized, trades: p.trades });
});

/* GET /api/exchange/leaderboard/ — richest portfolios */
router.get('/leaderboard/', (req, res) => {
  const rows = Object.entries(store.get().portfolios)
    .map(([user, p]) => ({ user, value: valueOf(p), realized: p.realized }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
  res.json({ leaders: rows });
});

module.exports = router;
