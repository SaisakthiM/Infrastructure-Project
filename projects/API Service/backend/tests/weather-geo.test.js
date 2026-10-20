const request = require('supertest');
const app = require('../app');
const axios = require('axios');
const cache = require('../lib/cache');
const { foldForecast } = require('../routes/weather');

jest.mock('axios');

beforeEach(() => {
  axios.get.mockReset();
  cache.clear();
});

describe('weather validation', () => {
  test('rejects a non-numeric latitude without calling the provider', async () => {
    const res = await request(app).get('/api/weather/').query({ lat: 'abc', lon: 10 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/lat/);
    expect(axios.get).not.toHaveBeenCalled();
  });

  test('rejects a missing longitude', async () => {
    const res = await request(app).get('/api/weather/').query({ lat: 10 });
    expect(res.status).toBe(400);
    expect(axios.get).not.toHaveBeenCalled();
  });

  test('latitude errors say latitude', async () => {
    const res = await request(app).get('/api/weather/').query({ lat: 120, lon: 0 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Latitude/);
  });
});

describe('weather upstream failures always get an answer', () => {
  test('provider rejecting our key is a 502', async () => {
    axios.get.mockRejectedValue({ response: { status: 401 } });
    const res = await request(app).get('/api/weather/').query({ lat: 10.1, lon: 10.1 });
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/credentials/);
  });

  test('unknown place upstream is a 404', async () => {
    axios.get.mockRejectedValue({ response: { status: 404 } });
    const res = await request(app).get('/api/weather/').query({ lat: 11.1, lon: 11.1 });
    expect(res.status).toBe(404);
  });

  test('timeouts are a 504', async () => {
    axios.get.mockRejectedValue({ code: 'ECONNABORTED' });
    const res = await request(app).get('/api/weather/').query({ lat: 12.1, lon: 12.1 });
    expect(res.status).toBe(504);
  });
});

describe('weather caching', () => {
  test('the same place twice costs one provider call', async () => {
    axios.get.mockResolvedValue({ data: { name: 'Karur' } });
    await request(app).get('/api/weather/').query({ lat: 10.95, lon: 78.08 });
    await request(app).get('/api/weather/').query({ lat: 10.95, lon: 78.08 });
    expect(axios.get).toHaveBeenCalledTimes(1);
  });
});

describe('forecast and air quality', () => {
  const list = [
    { dt_txt: '2026-10-18 09:00:00', main: { temp: 24, temp_min: 23, temp_max: 25 }, pop: 0.1, weather: [{ main: 'Clouds' }] },
    { dt_txt: '2026-10-18 12:00:00', main: { temp: 29, temp_min: 28, temp_max: 31 }, pop: 0.6, weather: [{ main: 'Rain' }] },
    { dt_txt: '2026-10-18 15:00:00', main: { temp: 28, temp_min: 27, temp_max: 30 }, pop: 0.4, weather: [{ main: 'Rain' }] },
    { dt_txt: '2026-10-19 09:00:00', main: { temp: 22, temp_min: 21, temp_max: 23 }, pop: 0, weather: [{ main: 'Clear' }] },
  ];

  test('foldForecast gives daily min, max, rain chance and the dominant condition', () => {
    const days = foldForecast(list);
    expect(days).toHaveLength(2);
    expect(days[0]).toEqual({ date: '2026-10-18', min: 23, max: 31, rainChance: 60, condition: 'Rain' });
    expect(days[1].condition).toBe('Clear');
  });

  test('GET /api/weather/forecast/', async () => {
    axios.get.mockResolvedValue({ data: { city: { name: 'Karur' }, list } });
    const res = await request(app).get('/api/weather/forecast/').query({ lat: 13.1, lon: 13.1 });
    expect(res.status).toBe(200);
    expect(res.body.city.name).toBe('Karur');
    expect(res.body.days).toHaveLength(2);
  });

  test('GET /api/weather/air/ labels the index', async () => {
    axios.get.mockResolvedValue({ data: { list: [{ main: { aqi: 4 }, components: { pm2_5: 40 } }] } });
    const res = await request(app).get('/api/weather/air/').query({ lat: 14.1, lon: 14.1 });
    expect(res.body).toEqual({ aqi: 4, label: 'Poor', components: { pm2_5: 40 } });
  });
});

describe('geo', () => {
  test('city is required', async () => {
    const res = await request(app).get('/api/geo/cod/').query({ state_code: '', country_code: 'FR' });
    expect(res.status).toBe(400);
    expect(axios.get).not.toHaveBeenCalled();
  });

  test('the query is URL-encoded', async () => {
    axios.get.mockResolvedValue({ data: [] });
    await request(app).get('/api/geo/cod/').query({ city: 'New York', country_code: 'US' });
    expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('q=New%20York%2CUS'));
  });

  test('reverse geocoding validates coordinates', async () => {
    const res = await request(app).get('/api/geo/reverse/').query({ lat: 0, lon: 500 });
    expect(res.status).toBe(400);
  });

  test('reverse geocoding returns the place', async () => {
    axios.get.mockResolvedValue({ data: [{ name: 'Karur', country: 'IN' }] });
    const res = await request(app).get('/api/geo/reverse/').query({ lat: 10.96, lon: 78.08 });
    expect(res.body[0].name).toBe('Karur');
  });
});
