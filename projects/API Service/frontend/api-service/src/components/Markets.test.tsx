import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { Markets } from './Markets'
import * as api from '../lib/api'

jest.mock('../lib/api')
const mocked = api as jest.Mocked<typeof api>

describe('Markets', () => {
  beforeEach(() => {
    mocked.getStocks.mockResolvedValue([
      { symbol: 'AAPL', close: 205, open: 200, high: 206, low: 199, changePct: 2.5, date: '2026-10-16' },
      { symbol: 'MSFT', close: 396, open: 400, high: 402, low: 390, changePct: -1, date: '2026-10-16' },
    ])
  })

  test('shows stock rows with signed day change', async () => {
    render(<Markets />)
    expect(await screen.findByText('AAPL')).toBeInTheDocument()
    expect(screen.getByText('+2.50%')).toBeInTheDocument()
    expect(screen.getByText('-1.00%')).toBeInTheDocument()
  })

  test('shows a friendly error when the provider fails', async () => {
    mocked.getStocks.mockRejectedValue(new Error('down'))
    render(<Markets />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load market data')
  })
})
