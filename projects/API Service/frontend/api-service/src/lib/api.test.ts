import '@testing-library/jest-dom'
import axios from 'axios'
import { BASE, buy, getExchangeQuotes, getFx, getPortfolio, requestOrderQuote, sell } from './api'

jest.mock('axios')
const mocked = axios as jest.Mocked<typeof axios>

beforeEach(() => {
  mocked.get.mockReset()
  mocked.post.mockReset()
})

describe('public endpoints', () => {
  test('exchange quotes unwraps the list', async () => {
    mocked.get.mockResolvedValue({ data: { quotes: [{ symbol: 'BANK', name: 'City Bank', price: 100, change: 1, history: [100] }] } })
    const quotes = await getExchangeQuotes()
    expect(quotes[0].symbol).toBe('BANK')
    expect(mocked.get).toHaveBeenCalledWith(`${BASE}/exchange/quotes/`)
  })

  test('fx passes the base currency', async () => {
    mocked.get.mockResolvedValue({ data: { base: 'EUR', date: null, rates: { INR: 90 } } })
    await getFx('EUR')
    expect(mocked.get).toHaveBeenCalledWith(`${BASE}/markets/fx/`, { params: { base: 'EUR' } })
  })
})

describe('trading sends the citizen identity', () => {
  const headers = { Authorization: 'Bearer t', 'X-City-Account': '7' }

  test('order quote', async () => {
    mocked.post.mockResolvedValue({ data: { quoteId: 'q1', symbol: 'BANK', qty: 2, price: 100, total: 200, expiresIn: 20 } })
    const q = await requestOrderQuote('BANK', 2, headers)
    expect(q.total).toBe(200)
    expect(mocked.post).toHaveBeenCalledWith(`${BASE}/exchange/quote/`, { symbol: 'BANK', qty: 2 }, { headers })
  })

  test('buy uses the quote id only (price comes from the server)', async () => {
    mocked.post.mockResolvedValue({ data: { ok: true } })
    await buy('q1', headers)
    expect(mocked.post).toHaveBeenCalledWith(`${BASE}/exchange/buy/`, { quoteId: 'q1' }, { headers })
  })

  test('sell returns proceeds', async () => {
    mocked.post.mockResolvedValue({ data: { ok: true, proceeds: 300 } })
    const r = await sell('MEDI', 3, headers)
    expect(r.proceeds).toBe(300)
  })

  test('portfolio', async () => {
    mocked.get.mockResolvedValue({ data: { user: 'alice', positions: [], value: 0, realized: 0, trades: 0 } })
    await getPortfolio(headers)
    expect(mocked.get).toHaveBeenCalledWith(`${BASE}/exchange/portfolio/`, { headers })
  })
})
