// The shared city modules are plain browser ES modules served by the gateway at /city-core/.
// They are loaded at runtime (not bundled) so every district shares one bank session and one three.js.

export type CitySnapshot = {
  mode: string
  loggedIn: boolean
  username: string | null
  balance: number | null
}

export type CityResult = { ok: boolean; message?: string; balance?: number | null }

export type CityApi = {
  mountHud: (opts: { service: string; title?: string; accent?: string }) => void
  snapshot: () => CitySnapshot
  on: (fn: (s: CitySnapshot) => void) => () => void
  spend: (service: string, amount: number, reason?: string) => Promise<CityResult>
  earn: (service: string, amount: number, reason?: string) => Promise<CityResult>
  identityHeaders: () => Record<string, string>
  openLogin: () => void
  toast: (message: string, kind?: string) => void
  money: (n: number) => string
}

// three.js objects are driven by the shared kit; typing them here would just mean re-declaring three.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ThreeKit = any

export type CityModules = { City: CityApi; three: ThreeKit }

let cached: Promise<CityModules> | null = null

export function loadCity(): Promise<CityModules> {
  if (!cached) {
    const core = '/city-core/city-core.js'
    const kit = '/city-core/city-3d.js'
    cached = Promise.all([import(/* @vite-ignore */ core), import(/* @vite-ignore */ kit)]).then(([c, t]) => ({
      City: c.default as CityApi,
      three: t as ThreeKit,
    }))
  }
  return cached
}
