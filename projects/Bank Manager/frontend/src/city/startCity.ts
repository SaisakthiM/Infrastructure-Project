// The shared city layer is plain browser ES modules served by the gateway at /city-core/ (not bundled).
// A variable URL keeps Vite/Rollup from trying to resolve it at build time.
export interface CityOpts {
  service: string;
  title: string;
  /** Omit this: city-app.js resolves the district's ward code + accent from the registry (THEME.md §1). */
  accent?: string;
  scene: string;
  home?: string;
  requireLogin?: boolean;
}

export function startCity(opts: CityOpts): Promise<unknown> {
  const url = "/city-core/city-app.js";
  return import(/* @vite-ignore */ url)
    .then((m: any) => m.startCityApp(opts))
    .catch((e) => console.warn("[city] shared layer unavailable (running standalone)", e));
}
