// Mini City look for Whisper's MUI UI. Colours, type and component chrome only — no component is replaced,
// so routing, sockets, auth and every handler stay exactly as they are.
//
//   import { ThemeProvider, CssBaseline } from '@mui/material';
//   import { createCityTheme } from './city/cityTheme';
//   <ThemeProvider theme={createCityTheme()}><CssBaseline />…</ThemeProvider>
//
// Anything the app sets itself with sx / style (e.g. the colour of a sent-message bubble) still wins over this theme.
import { createTheme } from '@mui/material/styles';

const MONO = "'DM Mono', ui-monospace, 'JetBrains Mono', Menlo, Consolas, monospace";
const DISPLAY = "'Syne', 'Segoe UI', system-ui, sans-serif";

export function createCityTheme({ accent = '#25d6a3', secondary = '#6aa8ff' } = {}) {
  const line = 'rgba(255,255,255,0.12)';
  const lineAccent = `color-mix(in srgb, ${accent} 45%, transparent)`;
  const glass = 'rgba(9,15,28,0.6)';
  const glassStrong = 'rgba(8,13,25,0.9)';
  const blur = 'blur(14px) saturate(1.2)';

  return createTheme({
    palette: {
      mode: 'dark',
      primary: { main: accent, contrastText: '#04070f' },
      secondary: { main: secondary },
      success: { main: '#34d399' },
      warning: { main: '#fbbf24' },
      error: { main: '#f87171' },
      // transparent page background: the 3D city (city-skin) shows through every layout box that uses background.default
      background: { default: 'rgba(6,9,19,0)', paper: glass },
      text: { primary: '#eef2f8', secondary: '#8d9bb0' },
      divider: line,
    },
    shape: { borderRadius: 14 },
    typography: {
      fontFamily: MONO,
      fontSize: 14,
      h1: { fontFamily: DISPLAY, fontWeight: 800, letterSpacing: '-0.03em' },
      h2: { fontFamily: DISPLAY, fontWeight: 800, letterSpacing: '-0.03em' },
      h3: { fontFamily: DISPLAY, fontWeight: 800, letterSpacing: '-0.02em' },
      h4: { fontFamily: DISPLAY, fontWeight: 700, letterSpacing: '-0.02em' },
      h5: { fontFamily: DISPLAY, fontWeight: 700, letterSpacing: '-0.01em' },
      h6: { fontFamily: DISPLAY, fontWeight: 700, letterSpacing: '-0.01em' },
      button: { textTransform: 'none', fontWeight: 600 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          html: { background: '#060913' },
          body: { background: 'transparent', color: '#eef2f8' },
          '::selection': { background: `color-mix(in srgb, ${accent} 40%, transparent)` },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none', border: `1px solid ${line}` },
        },
      },
      MuiAppBar: {
        defaultProps: { elevation: 0, color: 'transparent' },
        styleOverrides: {
          root: {
            backgroundColor: glass,
            backdropFilter: blur,
            WebkitBackdropFilter: blur,
            borderBottom: `1px solid ${line}`,
            boxShadow: 'none',
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: { backgroundColor: glass, backdropFilter: blur, WebkitBackdropFilter: blur, borderRight: `1px solid ${line}` },
        },
      },
      MuiCard: { styleOverrides: { root: { backdropFilter: blur, WebkitBackdropFilter: blur, boxShadow: '0 10px 40px rgba(0,0,0,0.42)' } } },
      MuiDialog: {
        styleOverrides: {
          paper: { backgroundColor: glassStrong, backdropFilter: blur, borderRadius: 18, border: `1px solid ${lineAccent}`, boxShadow: '0 30px 80px rgba(0,0,0,0.6)' },
        },
      },
      MuiBackdrop: { styleOverrides: { root: { backgroundColor: 'rgba(3,5,12,0.6)', backdropFilter: 'blur(6px)' } } },
      MuiMenu: { styleOverrides: { paper: { backgroundColor: glassStrong, backdropFilter: blur, border: `1px solid ${line}` } } },
      MuiPopover: { styleOverrides: { paper: { backgroundColor: glassStrong, backdropFilter: blur, border: `1px solid ${line}` } } },
      MuiTooltip: {
        styleOverrides: {
          tooltip: { backgroundColor: 'rgba(6,9,19,0.94)', border: `1px solid ${lineAccent}`, fontFamily: MONO, fontSize: 12 },
          arrow: { color: 'rgba(6,9,19,0.94)' },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: { borderRadius: 10, transition: 'transform .15s, box-shadow .15s, background .15s', '&:hover': { transform: 'translateY(-1px)' } },
          containedPrimary: {
            background: `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 55%, #3b82f6))`,
            color: '#04070f',
            boxShadow: `0 0 22px color-mix(in srgb, ${accent} 38%, transparent)`,
            '&:hover': { boxShadow: `0 0 30px color-mix(in srgb, ${accent} 60%, transparent)` },
          },
          outlined: { borderColor: line, '&:hover': { borderColor: lineAccent, background: 'rgba(255,255,255,0.06)' } },
        },
      },
      MuiIconButton: { styleOverrides: { root: { '&:hover': { background: 'rgba(255,255,255,0.08)' } } } },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            backgroundColor: 'rgba(4,8,18,0.62)',
            borderRadius: 12,
            '& .MuiOutlinedInput-notchedOutline': { borderColor: line },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: lineAccent },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: accent, borderWidth: 1 },
            '&.Mui-focused': { boxShadow: `0 0 0 3px color-mix(in srgb, ${accent} 22%, transparent)` },
          },
        },
      },
      MuiFilledInput: { styleOverrides: { root: { backgroundColor: 'rgba(4,8,18,0.62)', borderRadius: 12, '&:before, &:after': { display: 'none' } } } },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            '&:hover': { backgroundColor: 'rgba(255,255,255,0.06)' },
            '&.Mui-selected': { backgroundColor: `color-mix(in srgb, ${accent} 16%, transparent)`, '&:hover': { backgroundColor: `color-mix(in srgb, ${accent} 22%, transparent)` } },
          },
        },
      },
      MuiChip: { styleOverrides: { root: { borderRadius: 999, border: `1px solid ${line}` } } },
      MuiAvatar: { styleOverrides: { root: { border: `1px solid ${lineAccent}`, fontFamily: DISPLAY, fontWeight: 800 } } },
      MuiBadge: { styleOverrides: { badge: { boxShadow: `0 0 12px color-mix(in srgb, ${accent} 60%, transparent)` } } },
      MuiTabs: { styleOverrides: { indicator: { height: 3, borderRadius: 3, boxShadow: `0 0 12px ${accent}` } } },
      MuiDivider: { styleOverrides: { root: { borderColor: line } } },
      MuiSwitch: { styleOverrides: { track: { backgroundColor: 'rgba(255,255,255,0.25)' } } },
    },
  });
}

export default createCityTheme;
