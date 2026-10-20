# city-core — shared 3D + bank layer for every Mini City district

Static files, no build step, served by the gateway at `/city-core/`.

| File | What it is |
|---|---|
| `city-core.js` | Bank client (`City.spend / earn / login`), one session per origin, **Safe Mode**, HUD, login overlay, `City.api()` for district backends |
| `city-3d.js` | three.js kit: `createStage`, orbit/parallax camera, hover + click picking, skyline/robot loaders, towers, labels |
| `city.css` | Glass UI, HUD, forms, tables, toasts |
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
