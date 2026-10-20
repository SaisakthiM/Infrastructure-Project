# City skin — Whisper and Notes

I could not see the Whisper or Notes source (they were not in the zip), so nothing here replaces a component or touches
a request. The skin is **additive**: a live three.js scene behind the page plus a glass theme over whatever UI is
already there. Logic, routes, sockets, auth and storage are untouched. Remove the one `<script>` line (or add `?skin=off`
to the URL) and the old UI is back.

Both apps must be served by the gateway (same origin as `/city-core/`). Whisper's block in `gateway/nginx/default.conf`
is a commented template: fill in your container name and port, uncomment it.

## Notes (any stack: static HTML, Django template, React…)

In the page that loads the notes UI, inside `<head>`:

```html
<script type="importmap">
{ "imports": { "three": "/city-core/vendor/three/three.module.js", "three/addons/": "/city-core/vendor/three/addons/" } }
</script>
<script type="module" src="/city-core/city-skin.js"></script>
```

That is all. The theme is chosen from the URL (`/notes…` → desk at night with floating pages and a flickering lamp).
Force it with `<script>window.CITY_SKIN = { theme: 'notes', accent: '#e8b44f' }</script>` before the module line.

## Whisper (React + MUI)

1. Copy `whisper/frontend/src/city/` into the Whisper frontend (`src/city/`).
2. `index.html`: add the same `importmap` block as above (not the skin `<script>`; the component loads it).
3. Wrap the app and mount the backdrop — two small edits, wherever the theme / root is set up (usually `main.jsx` or `App.jsx`):

```jsx
import { ThemeProvider, CssBaseline } from '@mui/material';
import { createCityTheme } from './city/cityTheme';
import CityBackdrop from './city/CityBackdrop';

<ThemeProvider theme={createCityTheme()}>
  <CssBaseline />
  <CityBackdrop />        {/* renders nothing; draws the night city behind the app */}
  {/* …your existing <App/> / <RouterProvider/> unchanged… */}
</ThemeProvider>
```

If Whisper already has a `ThemeProvider`, keep it and merge: `createTheme(existingOptions, cityOptions)`, or simply
replace its `createTheme(...)` call with `createCityTheme()` — it only sets palette, type and component chrome.

What you get: transparent page background (the city shows through), glass app bar / drawer / dialogs / menus,
accent-gradient primary buttons, glowing focus rings, Syne headings. Colours your components set themselves
(sx / style — e.g. sent vs received bubbles) still win, on purpose.

## Tuning

- `window.CITY_SKIN = { theme: 'whisper' | 'notes', accent: '#hex' }` before the script.
- Hard-coded solid backgrounds in the app (`background: #fff`, `bgcolor: '#111'`) stay solid — change those to
  `transparent` / `rgba(9,15,28,.6)` where you want the city to show through.
- Performance: the scene caps the pixel ratio at 1.5, adapts resolution when frames are slow, and honours
  `prefers-reduced-motion`. No WebGL → the glass theme over a gradient.

## Want it fitted exactly?

Send me the Whisper `src/` (components + theme) and the Notes frontend. With the real component tree I can restyle
the chat list, bubbles, composer and note cards one by one instead of through a theme, still without changing behaviour.
