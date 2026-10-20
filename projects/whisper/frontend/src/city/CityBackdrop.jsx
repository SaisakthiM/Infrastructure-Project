import { useEffect } from 'react';

/**
 * The 3D city behind Whisper. Renders nothing; drop it anywhere inside <App/>:
 *
 *     <CityBackdrop />                      // whisper night-city with floating chat bubbles
 *
 * It loads the shared kit from the gateway (/city-core/), so it needs the same one-time import map as the
 * other districts in index.html (see city-core/SKIN.md). If /city-core/ is not reachable (plain `vite dev`
 * without the gateway proxy) or WebGL is missing, it silently does nothing and the app looks like before,
 * just with the glass theme.
 */
export default function CityBackdrop({ theme = 'whisper', accent }) {
  useEffect(() => {
    let off = () => {};
    let gone = false;
    window.CITY_SKIN_MANUAL = true;
    import(/* @vite-ignore */ '/city-core/city-skin.js')
      .then((m) => {
        if (!gone) off = m.mountSkin({ theme, accent });
      })
      .catch(() => {
        /* no shared core here: keep the plain UI */
      });
    return () => {
      gone = true;
      off();
    };
  }, [theme, accent]);
  return null;
}
