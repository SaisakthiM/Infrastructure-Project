// The Mini City exchange: six city companies with a mean-reverting random walk, nudged by trades.
// Start the clock with engine.start() (bin/www does); tests call engine.tick() by hand.
const store = require('./store');

const COMPANIES = [
  { symbol: 'BANK', name: 'City Bank', base: 100 },
  { symbol: 'MEDI', name: 'MediCore Health', base: 80 },
  { symbol: 'FRSH', name: 'FreshMart', base: 45 },
  { symbol: 'FILM', name: 'MediaWorks', base: 60 },
  { symbol: 'HOME', name: 'HomeBuilders', base: 120 },
  { symbol: 'DATA', name: 'DataVault', base: 90 },
];

const HISTORY = 120;
const TICK_MS = 5000;
const SIGMA = 0.004; // per-tick volatility
const REVERT = 0.0005; // pull toward the company's base value
const prices = {};
const history = {};
let timer = null;

function init() {
  const saved = store.get().prices;
  COMPANIES.forEach((c) => {
    prices[c.symbol] = saved[c.symbol] > 0 ? saved[c.symbol] : c.base;
    history[c.symbol] = [prices[c.symbol]];
  });
}

const bySymbol = (symbol) => COMPANIES.find((c) => c.symbol === symbol);

// standard normal via Box–Muller
function gauss() {
  const u = 1 - Math.random();
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function clamp(symbol, p) {
  const { base } = bySymbol(symbol);
  return Math.min(base * 3, Math.max(base * 0.3, p));
}

function tick() {
  COMPANIES.forEach(({ symbol, base }) => {
    let p = prices[symbol] * Math.exp(SIGMA * gauss());
    p += REVERT * (base - p);
    prices[symbol] = clamp(symbol, p);
    history[symbol].push(prices[symbol]);
    if (history[symbol].length > HISTORY) history[symbol].shift();
    store.get().prices[symbol] = prices[symbol];
  });
  store.save();
}

/** Trade price in whole rupees (the bank only moves integers). */
const price = (symbol) => Math.max(1, Math.round(prices[symbol]));

function quotes() {
  return COMPANIES.map(({ symbol, name }) => {
    const h = history[symbol];
    const first = h[0];
    return {
      symbol,
      name,
      price: price(symbol),
      change: Math.round(((prices[symbol] - first) / first) * 10000) / 100, // % over the visible window
      history: h.map((v) => Math.round(v * 100) / 100),
    };
  });
}

/** Trades move the price a little: 0.2 % per share, capped at 5 % per trade. */
function applyTrade(symbol, qty, side) {
  const impact = Math.min(qty * 0.002, 0.05) * (side === 'buy' ? 1 : -1);
  prices[symbol] = clamp(symbol, prices[symbol] * (1 + impact));
  store.get().prices[symbol] = prices[symbol];
  store.save();
}

function start() {
  if (timer) return;
  timer = setInterval(tick, TICK_MS);
  if (timer.unref) timer.unref();
}

function stop() {
  clearInterval(timer);
  timer = null;
}

store.load();
init();

module.exports = { COMPANIES, bySymbol, tick, price, quotes, applyTrade, start, stop, init };
