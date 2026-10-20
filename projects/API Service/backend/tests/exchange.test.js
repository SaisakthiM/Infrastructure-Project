const fs = require('fs');
const os = require('os');
const path = require('path');

// keep test portfolios out of the real data folder; must be set before the app loads the store
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'exchange-test-'));

const request = require('supertest');

jest.mock('axios');
// identity: the header x-test-user stands in for a citizen the bank has verified
jest.mock('../lib/cityAuth', () => ({
  verify: jest.fn(),
  requireCitizen: (req, res, next) => {
    const user = req.get('x-test-user');
    if (!user) return res.status(401).json({ error: 'Log in to the city bank first.' });
    req.citizen = user;
    return next();
  },
}));

const app = require('../app');
const engine = require('../lib/exchangeEngine');
const store = require('../lib/store');

const as = (user) => ({ 'x-test-user': user });

beforeEach(() => {
  store.get().portfolios = {};
  engine.init();
});

afterEach(() => jest.restoreAllMocks());

describe('engine', () => {
  test('prices stay inside the guard rails after many ticks', () => {
    for (let i = 0; i < 500; i += 1) engine.tick();
    engine.COMPANIES.forEach(({ symbol, base }) => {
      const p = engine.price(symbol);
      expect(p).toBeGreaterThanOrEqual(Math.max(1, Math.floor(base * 0.3)));
      expect(p).toBeLessThanOrEqual(Math.ceil(base * 3));
    });
  });

  test('trade prices are whole rupees', () => {
    engine.tick();
    expect(Number.isInteger(engine.price('BANK'))).toBe(true);
  });
});

describe('public quotes', () => {
  test('GET /api/exchange/quotes/', async () => {
    const res = await request(app).get('/api/exchange/quotes/');
    expect(res.status).toBe(200);
    expect(res.body.quotes).toHaveLength(engine.COMPANIES.length);
    expect(res.body.quotes[0]).toEqual(expect.objectContaining({ symbol: expect.any(String), price: expect.any(Number) }));
  });
});

describe('trading needs a citizen', () => {
  test.each([
    ['post', '/api/exchange/quote/'],
    ['post', '/api/exchange/buy/'],
    ['post', '/api/exchange/sell/'],
    ['get', '/api/exchange/portfolio/'],
  ])('%s %s -> 401', async (method, url) => {
    const res = await request(app)[method](url).send({});
    expect(res.status).toBe(401);
  });
});

describe('buy flow: quote -> pay -> buy', () => {
  async function quote(user, symbol = 'BANK', qty = 3) {
    return request(app).post('/api/exchange/quote/').set(as(user)).send({ symbol, qty });
  }

  test('quote prices the order server-side', async () => {
    const res = await quote('alice', 'BANK', 3);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(res.body.price * 3);
    expect(res.body.quoteId).toBeTruthy();
  });

  test('buy executes once at the quoted price and shows up in the portfolio', async () => {
    const q = (await quote('alice', 'BANK', 4)).body;
    const buy = await request(app).post('/api/exchange/buy/').set(as('alice')).send({ quoteId: q.quoteId });
    expect(buy.status).toBe(201);
    expect(buy.body.total).toBe(q.total);

    const again = await request(app).post('/api/exchange/buy/').set(as('alice')).send({ quoteId: q.quoteId });
    expect(again.status).toBe(404); // single use

    const pf = await request(app).get('/api/exchange/portfolio/').set(as('alice'));
    expect(pf.body.positions).toHaveLength(1);
    expect(pf.body.positions[0]).toEqual(expect.objectContaining({ symbol: 'BANK', qty: 4 }));
  });

  test("nobody can spend another citizen's quote", async () => {
    const q = (await quote('alice')).body;
    const res = await request(app).post('/api/exchange/buy/').set(as('mallory')).send({ quoteId: q.quoteId });
    expect(res.status).toBe(404);
  });

  test('expired quotes are refused', async () => {
    const q = (await quote('alice')).body;
    const real = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(real + 60 * 1000);
    const res = await request(app).post('/api/exchange/buy/').set(as('alice')).send({ quoteId: q.quoteId });
    expect(res.status).toBe(410);
  });

  test.each([[0], [1.5], [-2], [1001], ['abc']])('quantity %p is rejected', async (qty) => {
    const res = await quote('alice', 'BANK', qty);
    expect(res.status).toBe(400);
  });

  test('unknown symbols are rejected', async () => {
    const res = await quote('alice', 'NOPE', 1);
    expect(res.status).toBe(400);
  });

  test('a position is capped at 5000 shares', async () => {
    for (let i = 0; i < 5; i += 1) {
      const q = (await quote('whale', 'FRSH', 1000)).body;
      await request(app).post('/api/exchange/buy/').set(as('whale')).send({ quoteId: q.quoteId });
    }
    const res = await quote('whale', 'FRSH', 1);
    expect(res.status).toBe(409);
  });
});

describe('sell flow', () => {
  async function own(user, symbol, qty) {
    const q = (await request(app).post('/api/exchange/quote/').set(as(user)).send({ symbol, qty })).body;
    await request(app).post('/api/exchange/buy/').set(as(user)).send({ quoteId: q.quoteId });
  }

  test('cannot sell what you do not own', async () => {
    const res = await request(app).post('/api/exchange/sell/').set(as('alice')).send({ symbol: 'MEDI', qty: 1 });
    expect(res.status).toBe(409);
  });

  test('selling pays proceeds at the current price and closes the position', async () => {
    await own('alice', 'MEDI', 5);
    const res = await request(app).post('/api/exchange/sell/').set(as('alice')).send({ symbol: 'MEDI', qty: 5 });
    expect(res.status).toBe(200);
    expect(res.body.proceeds).toBe(res.body.price * 5);

    const pf = await request(app).get('/api/exchange/portfolio/').set(as('alice'));
    expect(pf.body.positions).toHaveLength(0);
  });

  test('partial sells keep the rest', async () => {
    await own('alice', 'HOME', 10);
    await request(app).post('/api/exchange/sell/').set(as('alice')).send({ symbol: 'HOME', qty: 4 });
    const pf = await request(app).get('/api/exchange/portfolio/').set(as('alice'));
    expect(pf.body.positions[0].qty).toBe(6);
  });
});

describe('leaderboard', () => {
  test('lists the richest portfolios, richest first', async () => {
    const buy = async (user, qty) => {
      const q = (await request(app).post('/api/exchange/quote/').set(as(user)).send({ symbol: 'DATA', qty })).body;
      await request(app).post('/api/exchange/buy/').set(as(user)).send({ quoteId: q.quoteId });
    };
    await buy('small', 1);
    await buy('big', 20);
    const res = await request(app).get('/api/exchange/leaderboard/');
    expect(res.body.leaders.map((l) => l.user)).toEqual(['big', 'small']);
  });
});
