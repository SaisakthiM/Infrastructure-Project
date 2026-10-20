# city-core — shared 3D + bank layer for every Mini City district

Static files, no build step, served by the gateway at `/city-core/`.

| File | What it is |
|---|---|
| `city-core.js` | Bank client (`City.spend / earn / login`), one session per origin, **Safe Mode**, HUD, login overlay, `City.api()` for district backends |
| `city-3d.js` | three.js kit: `createStage`, orbit/parallax camera, hover + click picking, skyline/robot loaders, towers, labels |
| `city.css` | Glass UI, HUD, forms, tables, toasts, login gate |
| `city-gate.js` + `city-gate.css` | One line that makes ANY page (the city home…) ask for the bank login first — see below |
| `city-skin.js` + `city-skin.css` | 3D backdrop + glass theme for apps we don't rebuild (Whisper, Notes) — see `SKIN.md` |
| `vendor/three/` | three r160 + GLTF/Draco/Orbit/SkeletonUtils (self-hosted, no CDN) |
| `models/` | `robot.glb` (your city robot), `city.glb` (your skyline), `Fox.glb` |
| `textures/` | Earth day / night lights / clouds (three.js examples) |
| `draco/` | Draco decoder (needed by `city.glb`) |

## Using it from a page

```html
<script type="importmap">
{ "imports": { "three": "/city-core/vendor/three/three.module.js", "three/addons/": "/city-core/vendor/three/addons/" } }
</script>
<link rel="stylesheet" href="/city-core/city.css">
<script type="module">
  import City from '/city-core/city-core.js';
  import { createStage } from '/city-core/city-3d.js';
  City.mountHud({ service: 'grocery', title: 'Grocery', accent: '#72b66f' });
  const stage = createStage(document.body);          // stage.ok === false when WebGL is missing
  const paid = await City.spend('grocery', 120, 'Groceries');   // { ok, message, balance }
</script>
```

## How money flows

1. The browser moves money with the bank (`City.spend` = withdraw, `City.earn` = deposit; whole rupees).
2. Then it tells the district backend (`City.api(...)`, which adds the citizen's bank token headers).
3. The district backend **verifies the citizen by replaying the token against the bank** (`GET /accounts/{id}`) — no shared secrets, no JWT parsing — and owns the domain rules (stock, prices, cooldowns, wages, caps).
4. If the backend refuses after the bank was charged, the browser refunds itself.

### Safe Mode
Bank unreachable -> chip turns amber. You can still spend money you already hold, but **only at one service** (the first you spend at); earnings are queued locally and applied when the bank answers (inflight items are reconciled against the balance, because the bank has no idempotency keys). District backends keep accepting a citizen they verified in the last 24 h while the bank is down.

## Known limits (be aware, not blockers)
- The bank lets any logged-in user deposit any amount into their own account, so this economy is **trust-based**, not tamper-proof. The district rules above keep honest play consistent; real enforcement needs a server-side ledger/treasury in the bank.
- The activity ledger (`City.ledger()`) is per browser; the bank has no transaction-history endpoint.
- A tab closed between "backend approved" and "bank credited" (selling shares, treating a patient, claiming creator earnings, rent) loses that one payout.


## Login gate, local vault, bank fallbacks (new)

- **Gate.** `City.mountHud()` now defaults to `requireLogin: true`: the page is blurred and inert until somebody signs in
  (non-dismissible; re-opens on logout or token expiry). For a page that is not a district, add one line:
  `<script type="module" src="/city-core/city-gate.js"></script>` (it brings its own scoped CSS).
- **Local vault.** After each successful login this device stores the username, the bank token, the last balance and a
  salted PBKDF2-SHA256 verifier (150k iterations) of the password — **never the password**. Needs a secure context
  (https or localhost). HUD menu → *Forget this device* wipes it.
- **Bank down?**
  - known person → signs in against the verifier, Safe Mode on (spend from the cached balance at one service, earnings
    queued). When the bank answers again the session is upgraded silently if the tab kept the password in memory,
    otherwise a banner asks for one more sign-in; the queue is then applied.
  - unknown person / new account → refused ("the city is closed until the bank is back") with a Retry button.
- **Fallback bank URLs.** Tried in order, first answer is remembered: `window.CITY_BANK_BASE`, `window.CITY_BANK_BASES`,
  `/bank/api`, and on localhost `http://localhost:8080/api`. Money-moving calls (`withdraw`/`deposit`) never fail over
  (a retry elsewhere after a timeout could charge twice); reads, login and register do.
- An HTML error page from the gateway (nginx 403/404/502) now counts as "bank down" instead of logging you out.
