const request = require('supertest');
const app = require('../app');
const axios = require('axios');
const cache = require('../lib/cache');
const { parseStooq } = require('../routes/markets');

jest.mock('axios');

beforeEach(() => {
  axios.get.mockReset();
  cache.clear();
});

const CSV = [
  'Symbol,Date,Time,Open,High,Low,Close,Volume',
  'AAPL.US,2026-10-16,22:00:09,200,206,199,205,5000000',
  'ZZZZ.US,N/D,N/D,N/D,N/D,N/D,N/D,N/D',
  'MSFT.US,2026-10-16,22:00:09,400,402,390,396,3000000',
].join('\n');

describe('parseStooq', () => {
  test('keeps real quotes, drops N/D rows, computes the day change', () => {
    const q = parseStooq(CSV);
    expect(q.map((x) => x.symbol)).toEqual(['AAPL', 'MSFT']);
    expect(q[0].changePct).toBe(2.5);
    expect(q[1].changePct).toBe(-1);
  });
});

describe('GET /api/markets/stocks/', () => {
  test('returns parsed quotes and asks the provider for .us symbols', async () => {
    axios.get.mockResolvedValue({ data: CSV });
    const res = await request(app).get('/api/markets/stocks/').query({ symbols: 'AAPL,MSFT' });
    expect(res.status).toBe(200);
    expect(res.body.quotes).toHaveLength(2);
    expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('aapl.us%2Cmsft.us'));
  });

  test('refuses suspicious symbols', async () => {
    const res = await request(app).get('/api/markets/stocks/').query({ symbols: 'AAPL;DROP' });
    expect(res.status).toBe(400);
    expect(axios.get).not.toHaveBeenCalled();
  });

  test('refuses more than 10 symbols', async () => {
    const res = await request(app).get('/api/markets/stocks/').query({ symbols: 'A,B,C,D,E,F,G,H,I,J,K' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/markets/crypto/', () => {
  test('flattens the provider answer', async () => {
    axios.get.mockResolvedValue({ data: { bitcoin: { usd: 70000, inr: 5800000, usd_24h_change: 1.2345 } } });
    const res = await request(app).get('/api/markets/crypto/').query({ ids: 'bitcoin' });
    expect(res.body.coins).toEqual([{ id: 'bitcoin', usd: 70000, inr: 5800000, change24h: 1.23 }]);
  });

  test('refuses odd ids', async () => {
    const res = await request(app).get('/api/markets/crypto/').query({ ids: 'bitcoin,../etc' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/markets/fx/', () => {
  test('returns rates', async () => {
    axios.get.mockResolvedValue({ data: { base: 'USD', date: '2026-10-16', rates: { INR: 88.1 } } });
    const res = await request(app).get('/api/markets/fx/').query({ base: 'usd', symbols: 'inr' });
    expect(res.body.rates.INR).toBe(88.1);
    expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('base=USD&symbols=INR'));
  });

  test('validates the base currency', async () => {
    const res = await request(app).get('/api/markets/fx/').query({ base: 'DOLLAR' });
    expect(res.status).toBe(400);
  });

  test('a provider outage is a clean 502', async () => {
    axios.get.mockRejectedValue(new Error('boom'));
    const res = await request(app).get('/api/markets/fx/').query({ base: 'EUR' });
    expect(res.status).toBe(502);
  });
});

describe('world data', () => {
  test('quakes are simplified', async () => {
    axios.get.mockResolvedValue({
      data: { features: [{ id: 'us1', properties: { mag: 5.1, place: '10km N of Somewhere', time: 1 }, geometry: { coordinates: [100.5, -2.5, 33] } }] },
    });
    const res = await request(app).get('/api/world/quakes/');
    expect(res.body.quakes[0]).toEqual({ id: 'us1', mag: 5.1, place: '10km N of Somewhere', time: 1, lon: 100.5, lat: -2.5, depth: 33 });
  });

  test('iss position is numeric', async () => {
    axios.get.mockResolvedValue({ data: { iss_position: { latitude: '12.5', longitude: '-45.25' }, timestamp: 99 } });
    const res = await request(app).get('/api/world/iss/');
    expect(res.body).toEqual({ lat: 12.5, lon: -45.25, timestamp: 99 });
  });
});
