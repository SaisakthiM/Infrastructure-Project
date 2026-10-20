export function fmtMoney(n: number): string {
  if (!Number.isFinite(n)) return '₹–'
  return '₹' + Math.round(n).toLocaleString('en-IN')
}

export function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '–'
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}

/** Point on a sphere for a latitude/longitude, matching how three.js maps an equirectangular texture. */
export function latLonToXYZ(lat: number, lon: number, radius: number): [number, number, number] {
  const phi = ((90 - lat) * Math.PI) / 180
  const theta = ((lon + 180) * Math.PI) / 180
  return [-radius * Math.sin(phi) * Math.cos(theta), radius * Math.cos(phi), radius * Math.sin(phi) * Math.sin(theta)]
}

export function quakeColor(mag: number): number {
  if (mag >= 6.5) return 0xff2d55
  if (mag >= 5.5) return 0xff7a1a
  return 0xffd23f
}

export function errorMessage(e: unknown, fallback: string): string {
  const err = e as { response?: { data?: { error?: string } }; message?: string } | null
  return err?.response?.data?.error || fallback
}
