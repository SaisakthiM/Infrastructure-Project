/**
 * Nexus Social — Tailwind theme, wired to the Mini City design system (/city-core/city.css).
 *
 * The paper registry: warm bone surfaces, ink structure, one district accent. The grays are paper-tinted
 * (not neutral gray) so surfaces sit in the same family as the city's --paper / --paper-raised, and the
 * `violet` ramp is the D-06 indigo accent. Keep these hexes aligned with PALETTE in
 * /city-core/city-3d.js — that file is the source of truth per district.
 */

/** paper-tinted neutral ramp: 50/100 are the page fills, 900/950 are ink */
const paper = {
  50:  '#fbfaf7',
  100: '#f4f2ed',
  200: '#e8e4da',
  300: '#d3cec1',
  400: '#8a857a',
  500: '#6b675e',
  600: '#4a4740',
  700: '#33312c',
  800: '#22211d',
  900: '#171613',
  950: '#121212',
};

/** district accent ramp for social — 400 is exactly #4a5aa6, the same hex as PALETTE.social.
    Compressed on purpose: the components paint text with 300/400 on a paper page, so the whole ramp has to
    stay dark enough to read on bone ground. */
const accent = {
  50:  '#eef1f8',
  100: '#dce2f0',
  200: '#b7c2de',
  300: '#5c6cb0',
  400: '#4a5aa6',
  500: '#3f4d92',
  600: '#33407c',
  700: '#2a3566',
  800: '#222b52',
  900: '#1b2240',
};

/** destructive ramp — brick (--bad), dark enough to be a label, light enough to be a wash */
const danger = {
  50:  '#faeeec',
  100: '#f2dcd8',
  200: '#e2b3ab',
  300: '#c26a5c',
  400: '#a33a2e',
  500: '#8c3126',
  600: '#742a21',
  700: '#5d221b',
  800: '#471a15',
  900: '#33130f',
};

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        // city.css owns the real stack via --font-ui / --font-display; these are the Tailwind aliases
        sans: ['Archivo', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Archivo', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'Menlo', 'Consolas', 'monospace'],
      },
      /* type scale: the only sizes this app may set, and every one of them mirrors a city.css role.
         note 10 = .eyebrow / .plate .code / label.field · mini 11 = .btn / .city-toast
         cap 12 = .errorlist · meta 13 = .tbl .num · body 14 = body.city-body
         hd 19 = .glass .hd · h1 38 / h2 27 = .display
         Anything outside this list means a new city.css token is needed — not a bracket value. */
      fontSize: {
        note: ['10px', { lineHeight: '1.4', letterSpacing: '0.08em' }],
        mini: ['11px', { lineHeight: '1.45', letterSpacing: '0.06em' }],
        xs:   ['12px', { lineHeight: '1.45' }],
        cap:  ['12px', { lineHeight: '1.5' }],
        sm:   ['14px', { lineHeight: '1.5' }],
        base: ['14px', { lineHeight: '1.5' }],
        meta: ['13px', { lineHeight: '1.5' }],
        lg:   ['17px', { lineHeight: '1.4' }],
        xl:   ['19px', { lineHeight: '1.35' }],
        '2xl': ['27px', { lineHeight: '1.1' }],
        '3xl': ['38px', { lineHeight: '1.05' }],
      },
      colors: {
        // retarget the scales the components already use, so no component file has to change
        zinc: paper,
        neutral: paper,
        gray: paper,
        slate: paper,
        violet: accent,
        purple: accent,
        fuchsia: accent,
        indigo: accent,
        brand: accent,
        // destructive utilities (delete-post, error text) are registry brick, not Tailwind red
        red: danger,
        rose: danger,
        // city semantic colours, read straight from city.css so they can never drift
        city: {
          bg: 'var(--paper, #f4f2ed)',
          raised: 'var(--paper-raised, #fbfaf7)',
          surface: 'var(--glass-hover, rgba(18, 18, 18, 0.045))',
          line: 'var(--line, rgba(18, 18, 18, 0.15))',
          ink: 'var(--ink, #121212)',
          text: 'var(--text, #121212)',
          muted: 'var(--muted, rgba(18, 18, 18, 0.56))',
          accent: 'var(--accent, #4a5aa6)',
          // the registry's light-for-dark foreground (--accent-ink): filled accent buttons, the story
          // viewer and media wells. White (#fff) is not a city colour, so never paint text with it.
          'on-accent': 'var(--accent-ink, #f8f7f3)',
          ok: 'var(--ok, #3f7139)',
          warn: 'var(--warn, #a9741b)',
          bad: 'var(--bad, #a33a2e)',
        },
      },
      borderRadius: {
        city: '0px',
        'city-sm': '0px',
      },
      boxShadow: {
        // elevation is a soft ink shadow, never a glow: the backdrop is a daylight maquette
        city1: '0 1px 0 rgba(18, 18, 18, 0.05)',
        city2: '0 1px 0 rgba(18, 18, 18, 0.06), 0 6px 16px -12px rgba(18, 18, 18, 0.24)',
        city3: '0 32px 72px -28px rgba(18, 18, 18, 0.38), 0 2px 6px -2px rgba(18, 18, 18, 0.14)',
      },
      animation: {
        'story-progress': 'story-progress 5s linear forwards',
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn:  { from: { opacity: 0 },          to: { opacity: 1 } },
        slideUp: { from: { transform: 'translateY(20px)', opacity: 0 }, to: { transform: 'none' } },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
