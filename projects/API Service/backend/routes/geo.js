var express = require('express');
var router = express.Router();
const http = require('../lib/http');
const cache = require('../lib/cache');
const { parseCoords } = require('../lib/coords');

const key = () => process.env.API_KEY_WEATHER;
const DAY = 24 * 3600 * 1000;

/* GET /api/geo/cod/?city=&state_code=&country_code=  — place name -> coordinates */
router.get('/cod/', async function (req, res) {
  const { city, state_code, country_code } = req.query;
  if (typeof city !== 'string' || !city.trim() || city.length > 80) {
    return res.status(400).json({ error: 'city is required (max 80 characters)' });
  }
  const q = [city, state_code, country_code].filter((p) => typeof p === 'string' && p.trim()).map((p) => p.trim()).join(',');
  try {
    const data = await cache.remember(`geo:${q.toLowerCase()}`, DAY, async () => {
      const r = await http.get(`https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(q)}&limit=5&appid=${key()}`);
      return r.data;
    });
    res.json(data);
  } catch (err) {
    http.sendUpstreamError(res, err);
  }
});

/* GET /api/geo/reverse/?lat=&lon=  — coordinates -> place name */
router.get('/reverse/', async function (req, res) {
  const c = parseCoords(req.query);
  if (c.error) return res.status(400).json({ error: c.error });
  try {
    const data = await cache.remember(`rev:${c.lat.toFixed(2)},${c.lon.toFixed(2)}`, DAY, async () => {
      const r = await http.get(`https://api.openweathermap.org/geo/1.0/reverse?lat=${c.lat}&lon=${c.lon}&limit=1&appid=${key()}`);
      return r.data;
    });
    res.json(data);
  } catch (err) {
    http.sendUpstreamError(res, err);
  }
});

module.exports = router;
