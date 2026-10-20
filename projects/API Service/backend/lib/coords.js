// Parses ?lat=&lon= into numbers. Returns { lat, lon } or { error }.
function parseCoords(query) {
  const lat = Number(query.lat);
  const lon = Number(query.lon);
  if (query.lat === undefined || query.lat === '' || !Number.isFinite(lat)) return { error: 'lat is required and must be a number' };
  if (query.lon === undefined || query.lon === '' || !Number.isFinite(lon)) return { error: 'lon is required and must be a number' };
  if (lat < -90 || lat > 90) return { error: 'Latitude must be between -90 and 90' };
  if (lon < -180 || lon > 180) return { error: 'Longitude must be between -180 and 180' };
  return { lat, lon };
}

module.exports = { parseCoords };
