// The shared city modules are plain browser ES modules served by the gateway at /city-core/.
// They are loaded at runtime (not bundled), so every district shares one bank session and one three.js.
let cached = null

export function loadCity() {
  if (!cached) {
    cached = Promise.all([
      import(/* @vite-ignore */ '/city-core/city-core.js'),
      import(/* @vite-ignore */ '/city-core/city-3d.js'),
    ]).then(([core, three]) => ({ City: core.default, three }))
  }
  return cached
}
