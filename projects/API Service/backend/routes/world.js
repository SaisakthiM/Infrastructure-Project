// Live world data that feeds the 3D globe: earthquakes and the International Space Station.
var express = require('express');
var router = express.Router();
const http = require('../lib/http');
const cache = require('../lib/cache');

const USGS = process.env.USGS_URL || 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson';
const ISS = process.env.ISS_URL || 'http://api.open-notify.org/iss-now.json';

/* GET /api/world/quakes/ — magnitude 4.5+ in the last 24 h */
router.get('/quakes/', async function (req, res) {
  try {
    const quakes = await cache.remember('quakes', 5 * 60 * 1000, async () => {
      const r = await http.get(USGS);
      return ((r.data && r.data.features) || []).slice(0, 80).map((f) => ({
        id: f.id,
        mag: f.properties.mag,
        place: f.properties.place,
        time: f.properties.time,
        lon: f.geometry.coordinates[0],
        lat: f.geometry.coordinates[1],
        depth: f.geometry.coordinates[2],
      }));
    });
    res.json({ source: 'usgs.gov', quakes });
  } catch (err) {
    http.sendUpstreamError(res, err);
  }
});

/* GET /api/world/iss/ — where the station is right now */
router.get('/iss/', async function (req, res) {
  try {
    const pos = await cache.remember('iss', 5 * 1000, async () => {
      const r = await http.get(ISS);
      const p = (r.data && r.data.iss_position) || {};
      return { lat: Number(p.latitude), lon: Number(p.longitude), timestamp: r.data && r.data.timestamp };
    });
    res.json(pos);
  } catch (err) {
    http.sendUpstreamError(res, err);
  }
});

module.exports = router;
