// JSON-file persistence for the city exchange (prices + portfolios). Atomic writes, debounced.
const fs = require('fs');
const path = require('path');

const dir = () => process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const file = () => path.join(dir(), 'exchange.json');

let data = { prices: {}, portfolios: {} };
let timer = null;

function load() {
  try {
    data = JSON.parse(fs.readFileSync(file(), 'utf8'));
    data.prices = data.prices || {};
    data.portfolios = data.portfolios || {};
  } catch {
    data = { prices: {}, portfolios: {} };
  }
  return data;
}

function flush() {
  clearTimeout(timer);
  timer = null;
  try {
    fs.mkdirSync(dir(), { recursive: true });
    const tmp = file() + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data));
    fs.renameSync(tmp, file());
  } catch (err) {
    console.error('[store] could not save', err.message);
  }
}

function save() {
  if (timer) return;
  timer = setTimeout(flush, 2000);
  if (timer.unref) timer.unref();
}

const get = () => data;
function reset() {
  clearTimeout(timer);
  timer = null;
  data = { prices: {}, portfolios: {} };
}

module.exports = { load, save, flush, get, reset };
