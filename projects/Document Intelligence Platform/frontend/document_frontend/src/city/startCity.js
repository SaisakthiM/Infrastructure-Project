// Shared city layer: plain ES modules served by the gateway at /city-core/. A variable URL keeps Vite from bundling it.
export function startCity(opts) {
  const url = '/city-core/city-app.js'
  return import(/* @vite-ignore */ url)
    .then((m) => m.startCityApp(opts))
    .catch((e) => console.warn('[city] shared layer unavailable (running standalone)', e))
}
