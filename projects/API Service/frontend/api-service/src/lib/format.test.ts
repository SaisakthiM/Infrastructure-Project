import '@testing-library/jest-dom'
import { errorMessage, fmtMoney, fmtPct, latLonToXYZ, quakeColor } from './format'

describe('fmtMoney / fmtPct', () => {
  test('money keeps the rupee sign', () => {
    expect(fmtMoney(5)).toBe('₹5')
    expect(fmtMoney(Number.NaN)).toBe('₹–')
  })

  test('percent has an explicit sign for gains', () => {
    expect(fmtPct(1.234)).toBe('+1.23%')
    expect(fmtPct(-0.5)).toBe('-0.50%')
    expect(fmtPct(0)).toBe('0.00%')
    expect(fmtPct(null)).toBe('–')
  })
})

describe('latLonToXYZ', () => {
  const close = (a: number[], b: number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 6))

  test('known points on a radius-10 sphere', () => {
    close(latLonToXYZ(0, 0, 10), [10, 0, 0])
    close(latLonToXYZ(90, 0, 10), [0, 10, 0])
    close(latLonToXYZ(-90, 123, 10), [0, -10, 0])
    close(latLonToXYZ(0, 90, 10), [0, 0, -10])
  })

  test('points stay on the sphere', () => {
    const [x, y, z] = latLonToXYZ(13.0836, 80.2705, 7)
    expect(Math.hypot(x, y, z)).toBeCloseTo(7, 6)
  })
})

describe('quakeColor', () => {
  test('bigger quakes are hotter', () => {
    expect(quakeColor(4.6)).toBe(0xffd23f)
    expect(quakeColor(5.8)).toBe(0xff7a1a)
    expect(quakeColor(7.1)).toBe(0xff2d55)
  })
})

describe('errorMessage', () => {
  test('prefers the server message', () => {
    expect(errorMessage({ response: { data: { error: 'Quote expired' } } }, 'fallback')).toBe('Quote expired')
  })
  test('falls back', () => {
    expect(errorMessage(new Error('x'), 'fallback')).toBe('fallback')
    expect(errorMessage(null, 'fallback')).toBe('fallback')
  })
})
