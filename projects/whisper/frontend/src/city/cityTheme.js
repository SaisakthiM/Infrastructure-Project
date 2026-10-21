// Mini City look for Whisper's MUI UI. Colours, type and component chrome only — no component is replaced,
// so routing, sockets, auth and every handler stay exactly as they are.
//
//   import { ThemeProvider, CssBaseline } from '@mui/material';
//   import { createCityTheme } from './city/cityTheme';
//   <ThemeProvider theme={createCityTheme()}><CssBaseline />…</ThemeProvider>
//
// Anything the app sets itself with sx / style (e.g. the colour of a sent-message bubble) still wins over this theme.
//
// Paper registry (city-core/THEME.md): warm bone paper, black ink structure, hairline rules, radius 0,
// one district accent. Whisper is D-11 (#0f7a8c cyan). city.css / city-skin.css own the tokens; this file only
// mirrors them into MUI's palette because MUI cannot read CSS custom properties for every slot.
import { createTheme } from '@mui/material/styles';

// the two faces the registry allows — the same pair /city-core/city.css loads
const UI = "'Archivo', 'Helvetica Neue', ui-sans-serif, system-ui, 'Segoe UI', sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace";

// token mirror of city.css (change it there, then here — never the other way round)
const PAPER = '#f4f2ed';
const RAISED = '#fbfaf7';
const INK = '#121212';
const GLASS = 'rgba(244, 242, 237, 0.86)';
const GLASS_STRONG = 'rgba(251, 250, 247, 0.97)';
const LINE = 'rgba(18, 18, 18, 0.15)';
const LINE_STRONG = 'rgba(18, 18, 18, 0.3)';
const TEXT_DIM = 'rgba(18, 18, 18, 0.76)';
const MUTED = 'rgba(18, 18, 18, 0.56)';
const OK = '#3f7139';
const WARN = '#a9741b';
const BAD = '#a33a2e';

export function createCityTheme({ accent = '#0f7a8c', secondary = '#6e7042' } = {}) {
  const lineAccent = `color-mix(in srgb, ${accent} 38%, transparent)`;
  const accentSoft = `color-mix(in srgb, ${accent} 10%, transparent)`;
  const wash = `color-mix(in srgb, ${accent} 7%, transparent)`;
  const blur = 'blur(14px) saturate(1.04)';
  const label = { fontFamily: MONO, fontSize: 11, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase' };

  return createTheme({
    palette: {
      mode: 'light',
      primary: { main: accent, contrastText: PAPER, light: `color-mix(in srgb, ${accent} 70%, #ffffff)`, dark: `color-mix(in srgb, ${accent} 82%, #000000)` },
      secondary: { main: secondary, contrastText: PAPER },
      success: { main: OK },
      warning: { main: WARN },
      error: { main: BAD },
      grey: { 100: RAISED, 200: LINE, 500: MUTED, 800: INK, 900: INK },
      // transparent page background: the 3D maquette (city-skin) shows through every layout box that uses background.default
      background: { default: 'rgba(244, 242, 237, 0)', paper: GLASS },
      text: { primary: INK, secondary: TEXT_DIM, disabled: MUTED },
      divider: LINE,
    },
    shape: { borderRadius: 0 }, // circles stay circles via MuiAvatar/MuiChip
    typography: {
      fontFamily: UI,
      fontSize: 14,
      h1: { fontFamily: UI, fontVariationSettings: "'wdth' 80", fontWeight: 500, letterSpacing: '-0.035em', lineHeight: 1.05 },
      h2: { fontFamily: UI, fontVariationSettings: "'wdth' 80", fontWeight: 500, letterSpacing: '-0.035em', lineHeight: 1.05 },
      h3: { fontFamily: UI, fontVariationSettings: "'wdth' 80", fontWeight: 500, letterSpacing: '-0.035em', lineHeight: 1.1 },
      h4: { fontFamily: UI, fontVariationSettings: "'wdth' 80", fontWeight: 500, letterSpacing: '-0.035em', lineHeight: 1.15 },
      h5: { fontFamily: UI, fontVariationSettings: "'wdth' 80", fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1.2 },
      h6: { fontFamily: UI, fontVariationSettings: "'wdth' 80", fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1.25 },
      subtitle1: { fontWeight: 500, color: TEXT_DIM },
      subtitle2: { ...label, color: MUTED },
      overline: { ...label, color: MUTED },
      caption: { fontFamily: MONO, fontSize: 11, color: MUTED },
      button: { ...label, fontWeight: 500 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          // the skin layer paints the paper and the drafting grid; body stays transparent so the scene reads through
          html: { background: PAPER, colorScheme: 'light' },
          body: { background: 'transparent', color: INK, letterSpacing: '-0.011em', fontVariantNumeric: 'tabular-nums' },
          '::selection': { background: accent, color: PAPER },
          ':focus-visible': { outline: `2px solid ${accent}`, outlineOffset: 2 },
        },
      },
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: { backgroundImage: 'none', border: `1px solid ${LINE}` },
        },
      },
      MuiAppBar: {
        defaultProps: { elevation: 0, color: 'transparent' },
        styleOverrides: {
          root: {
            backgroundColor: GLASS,
            backdropFilter: blur,
            WebkitBackdropFilter: blur,
            borderBottom: `1px solid ${INK}`,
            boxShadow: 'none',
            color: INK,
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: { backgroundColor: GLASS, backdropFilter: blur, WebkitBackdropFilter: blur, borderRight: `1px solid ${LINE}`, color: INK },
        },
      },
      // separation is hairlines, not shadows: only things that float get one
      MuiCard: { styleOverrides: { root: { backgroundColor: GLASS, border: `1px solid ${LINE}`, backdropFilter: blur, WebkitBackdropFilter: blur, boxShadow: '0 1px 0 rgba(18, 18, 18, 0.05)', '&:hover': { borderColor: LINE_STRONG } } } },
      MuiDialog: {
        styleOverrides: {
          paper: {
            backgroundColor: GLASS_STRONG,
            backdropFilter: blur,
            WebkitBackdropFilter: blur,
            border: `1px solid ${INK}`,
            borderTop: `2px solid ${accent}`,
            boxShadow: '0 8px 24px -12px rgba(18, 18, 18, 0.28)',
          },
        },
      },
      MuiBackdrop: { styleOverrides: { root: { backgroundColor: 'rgba(244, 242, 237, 0.72)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' } } },
      MuiMenu: { styleOverrides: { paper: { backgroundColor: GLASS_STRONG, backdropFilter: blur, WebkitBackdropFilter: blur, border: `1px solid ${INK}`, boxShadow: '0 8px 24px -12px rgba(18, 18, 18, 0.28)' } } },
      MuiPopover: { styleOverrides: { paper: { backgroundColor: GLASS_STRONG, backdropFilter: blur, WebkitBackdropFilter: blur, border: `1px solid ${INK}`, boxShadow: '0 8px 24px -12px rgba(18, 18, 18, 0.28)' } } },
      MuiTooltip: {
        styleOverrides: {
          tooltip: { backgroundColor: INK, color: PAPER, border: 'none', fontFamily: MONO, fontSize: 11, letterSpacing: '0.04em', borderRadius: 0 },
          arrow: { color: INK },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: { ...label, border: `1px solid ${INK}`, backgroundColor: RAISED, color: INK, borderRadius: 0, boxShadow: 'none', transition: 'background .14s, border-color .14s, color .14s', '&:hover': { transform: 'none', backgroundColor: wash, borderColor: accent, color: accent, boxShadow: 'none' } },
          contained: { backgroundColor: RAISED, color: INK, '&:hover': { backgroundColor: wash, color: accent } },
          containedPrimary: {
            background: accent,
            border: `1px solid ${accent}`,
            color: PAPER,
            boxShadow: 'none',
            '&:hover': { background: `color-mix(in srgb, ${accent} 82%, #000000)`, borderColor: `color-mix(in srgb, ${accent} 82%, #000000)`, color: PAPER, boxShadow: 'none' },
          },
          containedError: { background: BAD, color: PAPER, boxShadow: 'none', '&:hover': { background: `color-mix(in srgb, ${BAD} 85%, #000000)`, boxShadow: 'none' } },
          text: { color: MUTED, borderColor: 'transparent', backgroundColor: 'transparent', '&:hover': { color: INK, backgroundColor: 'rgba(18, 18, 18, 0.045)', borderColor: 'transparent' } },
          outlined: { borderColor: LINE_STRONG, '&:hover': { borderColor: accent, color: accent, backgroundColor: wash } },
        },
      },
      MuiIconButton: { styleOverrides: { root: { color: MUTED, '&:hover': { background: 'rgba(18, 18, 18, 0.045)', color: INK } } } },
      MuiFab: { styleOverrides: { root: { borderRadius: 0, boxShadow: '0 8px 24px -12px rgba(18, 18, 18, 0.28)' } } },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            backgroundColor: RAISED,
            borderRadius: 0,
            color: INK,
            '& .MuiOutlinedInput-notchedOutline': { borderColor: LINE_STRONG, borderRadius: 0 },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: INK },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: accent, borderWidth: 1 },
            '&.Mui-focused': { boxShadow: `0 0 0 3px ${accentSoft}` },
          },
        },
      },
      MuiFilledInput: { styleOverrides: { root: { backgroundColor: RAISED, borderRadius: 0, color: INK, '&:before, &:after': { display: 'none' }, '&:hover': { backgroundColor: 'rgba(18, 18, 18, 0.045)' } } } },
      MuiInputBase: { styleOverrides: { input: { '&::placeholder': { color: 'rgba(18, 18, 18, 0.38)', opacity: 1 } } } },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 0,
            '&:hover': { backgroundColor: wash },
            '&.Mui-selected': { backgroundColor: accentSoft, color: accent, '&:hover': { backgroundColor: `color-mix(in srgb, ${accent} 14%, transparent)` } },
          },
        },
      },
      MuiListItemText: { styleOverrides: { secondary: { color: MUTED, fontSize: 12 } } },
      MuiChip: {
        styleOverrides: {
          root: { borderRadius: 0, border: `1px solid ${LINE_STRONG}`, backgroundColor: RAISED, color: MUTED, fontFamily: MONO, fontSize: 10, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase' },
          colorPrimary: { backgroundColor: accentSoft, borderColor: lineAccent, color: accent },
          avatar: { fontFamily: UI },
        },
      },
      MuiAvatar: { styleOverrides: { root: { border: `1px solid ${lineAccent}`, borderRadius: 9999, backgroundColor: RAISED, color: INK, fontFamily: UI, fontWeight: 500 } } },
      MuiBadge: { styleOverrides: { badge: { borderRadius: 0, fontFamily: MONO, fontSize: 10, boxShadow: `0 0 0 1px ${PAPER}` } } },
      // one accent rule under the active tab — the registry's way of marking a selection
      MuiTabs: { styleOverrides: { indicator: { height: 2, borderRadius: 0, backgroundColor: accent, boxShadow: 'none' }, root: { minHeight: 40 } } },
      MuiTab: { styleOverrides: { root: { ...label, color: MUTED, '&.Mui-selected': { color: accent } } } },
      MuiDivider: { styleOverrides: { root: { borderColor: LINE } } },
      MuiSwitch: { styleOverrides: { track: { backgroundColor: LINE_STRONG, opacity: 1, borderRadius: 0 }, thumb: { borderRadius: 0 } } },
      MuiLinearProgress: { styleOverrides: { root: { height: 6, borderRadius: 0, backgroundColor: 'rgba(18, 18, 18, 0.1)', border: `1px solid ${LINE_STRONG}` }, bar: { borderRadius: 0, backgroundColor: accent } } },
      MuiTableCell: { styleOverrides: { root: { borderColor: LINE, fontVariantNumeric: 'tabular-nums' }, head: { ...label, color: MUTED, borderBottom: `1px solid ${INK}` } } },
      MuiTextField: { styleOverrides: { root: { '& .MuiInputLabel-root': { ...label, color: MUTED }, '& .MuiInputLabel-root.Mui-focused': { color: accent } } } },
    },
  });
}

export default createCityTheme;
