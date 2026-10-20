var express = require('express');
var router = express.Router();
const http = require('../lib/http');
const cache = require('../lib/cache');
const { parseCoords } = require('../lib/coords');

const key = () => process.env.API_KEY_WEATHER;
const FIVE_MIN = 5 * 60 * 1000;
const AQI_LABEL = ['', 'Good', 'Fair', 'Moderate', 'Poor', 'Very poor'];

/* GET /api/weather/?lat=&lon=  — current conditions */
router.get('/', async function (req, res) {
  const c = parseCoords(req.query);
  if (c.error) return res.status(400).json({ error: c.error });
  try {
    const data = await cache.remember(`wx:${c.lat.toFixed(2)},${c.lon.toFixed(2)}`, FIVE_MIN, async () => {
      const r = await http.get(`https://api.openweathermap.org/data/2.5/weather?lat=${c.lat}&lon=${c.lon}&appid=${key()}&units=metric`);
      return r.data;
    });
    res.json(data);
  } catch (err) {
    http.sendUpstreamError(res, err);
  }
});

/* GET /api/weather/forecast/?lat=&lon=  — the 3-hourly feed folded into daily min/max */
router.get('/forecast/', async function (req, res) {
  const c = parseCoords(req.query);
  if (c.error) return res.status(400).json({ error: c.error });
  try {
    const data = await cache.remember(`fc:${c.lat.toFixed(2)},${c.lon.toFixed(2)}`, 30 * 60 * 1000, async () => {
      const r = await http.get(`https://api.openweathermap.org/data/2.5/forecast?lat=${c.lat}&lon=${c.lon}&appid=${key()}&units=metric`);
      return r.data;
    });
    res.json({ city: data.city || null, days: foldForecast(data.list || []) });
  } catch (err) {
    http.sendUpstreamError(res, err);
  }
});

/* GET /api/weather/air/?lat=&lon=  — air quality index + pollutants */
router.get('/air/', async function (req, res) {
  const c = parseCoords(req.query);
  if (c.error) return res.status(400).json({ error: c.error });
  try {
    const data = await cache.remember(`aq:${c.lat.toFixed(2)},${c.lon.toFixed(2)}`, FIVE_MIN * 2, async () => {
      const r = await http.get(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${c.lat}&lon=${c.lon}&appid=${key()}`);
      return r.data;
    });
    const first = (data.list && data.list[0]) || {};
    const aqi = first.main && first.main.aqi;
    res.json({ aqi: aqi || null, label: AQI_LABEL[aqi] || 'Unknown', components: first.components || {} });
  } catch (err) {
    http.sendUpstreamError(res, err);
  }
});

function foldForecast(list) {
  const days = new Map();
  list.forEach((p) => {
    const date = String(p.dt_txt || '').slice(0, 10);
    if (!date) return;
    const d = days.get(date) || { date, min: Infinity, max: -Infinity, pop: 0, conditions: {} };
    const t = p.main || {};
    d.min = Math.min(d.min, t.temp_min !== undefined ? t.temp_min : t.temp);
    d.max = Math.max(d.max, t.temp_max !== undefined ? t.temp_max : t.temp);
    d.pop = Math.max(d.pop, p.pop || 0);
    const w = p.weather && p.weather[0] && p.weather[0].main;
    if (w) d.conditions[w] = (d.conditions[w] || 0) + 1;
    days.set(date, d);
  });
  return [...days.values()].slice(0, 5).map((d) => ({
    date: d.date,
    min: Math.round(d.min * 10) / 10,
    max: Math.round(d.max * 10) / 10,
    rainChance: Math.round(d.pop * 100),
    condition: Object.keys(d.conditions).sort((a, b) => d.conditions[b] - d.conditions[a])[0] || 'Unknown',
  }));
}

module.exports = router;
module.exports.foldForecast = foldForecast;
