# City theme — the paper registry

Single source of truth for every district's look. Change a value here, then chase it through the apps listed at the
bottom; do not invent a per-app variant.

**Idea:** the city is a town-planning office. The 3D world is a daylight architectural **maquette** — matte pale
buildings, ink hairline grid, one coloured roof plate per district. The UI is the **registry printed on the same
sheet**: warm paper, black ink, hairline rules, no rounded corners, no glow, mono district codes.

## 1. Colour

| Token | Value | Used for |
| --- | --- | --- |
| `--paper` | `#F4F2ED` | page ground, panel fill, text on accent |
| `--paper-raised` | `#FBFAF7` | inputs, tabs, hover-lifted panels |
| `--ink` | `#121212` | all text, all structure |
| `--muted` | `rgba(18,18,18,.56)` | secondary text, labels |
| `--line` | `rgba(18,18,18,.15)` | hairlines, rules, dividers |
| `--line-strong` | `rgba(18,18,18,.30)` | inputs, table header rule, edges that must hold |
| `--accent` | set per district | links, focus, primary action, plate rule |
| `--ok` / `--warn` / `--bad` | `#3F7139` / `#A9741B` / `#A33A2E` | moss, ochre, brick — dark enough to read on paper |

Derived, never hand-typed: `--accent-soft` = accent 10% on transparent, `--accent-line` = accent 38%,
`--wash` = accent 7% (hover fills). Text on a solid accent is always `--paper`.

**Never** reuse the old dark-theme values (`#0a0f1a`, `#e6ebf4`, `rgba(255,255,255,.04)`). Anything that lit text
white on near-black must invert to ink on paper.

### District registry

District order is registry order (`D-01 … D-12`), the way a ward list is numbered — it is an index, not a sequence,
so codes stay stable when a district is added or dropped.

| Code | District | Accent |
| --- | --- | --- |
| D-01 | Bank | `#0F6E9C` petrol |
| D-02 | Hospital | `#2B7E72` surgical teal |
| D-03 | Grocery | `#4C7C3F` moss |
| D-04 | Housing | `#966E35` bronze |
| D-05 | Blog · Inkwell | `#6E4A79` plum ink |
| D-06 | Social | `#4A5AA6` indigo |
| D-07 | Video | `#8D4850` oxblood |
| D-08 | API & Markets | `#3D4E66` slate |
| D-09 | Documents | `#6E7042` olive |
| D-10 | Compiler | `#4A4F55` graphite |
| D-11 | Whisper | `#0F7A8C` cyan |
| D-12 | Monitoring | `#9A4A32` brick |

Same hex in three places: `city-3d.js PALETTE`, `intro/v3/src/data/projects.ts`, and the app's own `index.html`
font/accent link.

## 2. Type

- **Archivo** (variable, `wght 100–900` + `wdth 62–125`). One family, two widths — that is the whole identity:
  - `--font-display`: `font-variation-settings:'wdth' 80`, weight 500, `letter-spacing:-.035em`, line-height 1.05.
    Used at 34–56px for titles, stats and the HUD district name. Never bolded above 600; the width axis does the work.
  - `--font-ui`: regular width, 400/500/600, 14px body, `letter-spacing:-.011em`.
- **JetBrains Mono** `--font-mono`: every uppercase label (eyebrow, table header, chip, HUD status), every amount
  and counter (`font-variant-numeric: tabular-nums`), and button text — 11px, weight 500, `letter-spacing:.1em`,
  uppercase. This is the signage voice; keep it to short strings, never body copy.
- Load exactly: `family=Archivo:wdth,wght@75..100,400..700&family=JetBrains+Mono:wght@400;500`.
  No Inter, no Instrument Serif, no Syne, no Playfair, no DM Mono — those are leftovers from earlier themes.

## 3. Structure

- Radius **0** everywhere (`--radius`, `--radius-sm`, `--radius-lg` all 0). Circles stay circles (dots, avatars).
- Separation is hairlines and 4px-wide accent rules, not shadows. Shadows only on things that genuinely float:
  menus, toasts, modals — `0 8px 24px -12px rgba(18,18,18,.28)`.
- `.glass` panels are 86% paper + `blur(14px)` so the maquette ghosts through; `blur` stays off on `prefers-reduced-transparency`.
- The **district plate**: `.plate` = mono code in a 1px ink box + district name in condensed display.
  It appears in the HUD, the login gate, panel headers via `.hd small`, and on the 3D roof labels.
  Real panels get their identity from `border-top: 2px solid var(--accent)`, applied with `.glass:has(> .hd)` —
  no extra marks to count.
- Motion: one orchestrated moment (panel rules draw in left-to-right, 240ms) and the blinking `_` after the balance,
  which means *connected to the bank*. Nothing else animates. All of it off under `prefers-reduced-motion`.

## 4. The 3D world

- Sky dome `#F7F5F0 → #E3DFD4`; fog matches the ground, density 0.010.
- Ground `#EDEAE1`, drafting grid in ink at 10% opacity, 1px feel.
- Buildings: body `#E7E3D9` / `#DCD7CA`, roof plate `var(--accent)`, edges ink. Down/disabled district = `#B9B4A8`
  body, grey plate, no accent.
- Lights: hemisphere sky `#F2EFE8` / ground `#C9C3B6` at 1.1, key directional `#FFF6E4` at 1.6 from 14,24,10.
- `glowMat()` keeps its signature but clamps emissive to a matte 0.0–0.35 — no neon on a paper city.
- Particles are dust motes `#A29A88`, low opacity, never coloured by accent.
- `labelSprite()` defaults to ink text on 94% paper.

## 5. Who owns what

`city-core/city.css` is the only place tokens are defined. Apps load it, then may only *consume* tokens.
Per-app stylesheets add their own class vocabulary and must not re-declare `--accent`, `--muted`, `--radius`,
`--text`, `--bg`, `--line`, `--font-*` (that collision is what made earlier passes look generic).
React/Tailwind apps bridge through their local `theme.css`, which maps shadcn names onto city tokens.

Apps to keep in sync: Bank, Hospital, Blog, Social, Video, API Service, Document, Grocery, Housing, Compiler,
Whisper, and the 3D home `intro/v3`.

**One sanctioned copy:** `infra-cli/webui/static/index.html` (the deploy dashboard on `:9000`). It is served by a
Go binary from `//go:embed`, on a different origin than the gateway, so it cannot load `/city-core/city.css`.
It carries its own literal copy of the §1 tokens and of the maquette palette in `cluster3d.js`. When a token
changes here, change it there — that duplication is deliberate, not a collision. It must stay paper: radius `0`,
`--paper #f4f2ed`, ink `#121212`, the district plate as every panel header, and the terminal sheet as the only
dark surface.
